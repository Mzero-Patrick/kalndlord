import { Router } from "express";
import multer from "multer";
import type { Prisma, PrismaClient, Property, User } from "@prisma/client";
import {
  applicationSchema,
  formatRwf,
  listingSchema,
  listingSearchSchema,
  listingUpdateSchema,
} from "@kalndlord/shared";
import type { Config } from "../config";
import type { Notifier } from "../notify";
import { sendError, zodFields } from "../lib/http";
import { notifyUser } from "../lib/notify-user";
import { contactSelect, toApplication, toListing } from "../lib/serialize";
import { imageExtension, type Storage } from "../lib/storage";
import { optionalAuth, requireAuth } from "../middleware/auth";

export const PAGE_SIZE = 12;
export const MAX_PHOTOS = 8;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: MAX_PHOTOS } });
const withPhotos = { photos: true, landlord: { select: { id: true, fullName: true } } } as const;

export const canManage = (user: User | undefined, property: Pick<Property, "landlordId">) =>
  !!user && (user.role === "ADMIN" || property.landlordId === user.id);

export function listingsRouter(prisma: PrismaClient, notifier: Notifier, storage: Storage, config: Config) {
  const router = Router();
  const auth = (roles?: Parameters<typeof requireAuth>[2]) => requireAuth(prisma, config.jwtSecret, roles);

  // Public search: only places that are available.
  router.get("/", async (req, res) => {
    const parsed = listingSearchSchema.safeParse(req.query);
    if (!parsed.success) return sendError(res, 400, "Check the search filters", zodFields(parsed.error));
    const { q, type, district, minRent, maxRent, page } = parsed.data;
    const where: Prisma.PropertyWhereInput = {
      status: "AVAILABLE",
      type,
      district,
      monthlyRent: { gte: minRent, lte: maxRent },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { sector: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      prisma.property.count({ where }),
      prisma.property.findMany({
        where,
        include: withPhotos,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    res.json({ total, page, pageSize: PAGE_SIZE, items: items.map((p) => toListing(p, storage)) });
  });

  // Landlords see their own listings, the administrator sees all of them.
  router.get("/mine", auth(["LANDLORD", "ADMIN"]), async (req, res) => {
    const items = await prisma.property.findMany({
      where: req.user!.role === "ADMIN" ? {} : { landlordId: req.user!.id },
      include: { ...withPhotos, _count: { select: { applications: { where: { status: "PENDING" } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      items: items.map((p) => ({ ...toListing(p, storage), pendingApplications: p._count.applications })),
    });
  });

  router.get("/:id", optionalAuth(prisma, config.jwtSecret), async (req, res) => {
    const property = await prisma.property.findUnique({ where: { id: String(req.params.id) }, include: withPhotos });
    if (!property) return sendError(res, 404, "This listing doesn't exist");
    if (property.status !== "AVAILABLE" && !canManage(req.user, property)) {
      // Tenants who applied or rent the place can still open it.
      const linked =
        req.user &&
        (await prisma.application.count({ where: { propertyId: property.id, tenantId: req.user.id } })) > 0;
      if (!linked) return sendError(res, 404, "This listing is no longer available");
    }
    const myApplication = req.user
      ? await prisma.application.findFirst({
          where: { propertyId: property.id, tenantId: req.user.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        })
      : null;
    res.json({ listing: toListing(property, storage), myApplication, canManage: canManage(req.user, property) });
  });

  router.post("/", auth(["LANDLORD", "ADMIN"]), async (req, res) => {
    const parsed = listingSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const { landlordId, ...data } = parsed.data;

    let ownerId = req.user!.id;
    if (req.user!.role === "ADMIN" && landlordId) {
      const landlord = await prisma.user.findUnique({ where: { id: landlordId } });
      if (!landlord || landlord.role !== "LANDLORD")
        return sendError(res, 400, "Pick a landlord account", { landlordId: "Pick a landlord account" });
      ownerId = landlord.id;
    }
    const property = await prisma.property.create({ data: { ...data, landlordId: ownerId }, include: withPhotos });
    res.status(201).json({ listing: toListing(property, storage) });
  });

  router.patch("/:id", auth(["LANDLORD", "ADMIN"]), async (req, res) => {
    const property = await prisma.property.findUnique({ where: { id: String(req.params.id) } });
    if (!property || !canManage(req.user, property)) return sendError(res, 404, "Listing not found");
    const parsed = listingUpdateSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const updated = await prisma.property.update({ where: { id: property.id }, data: parsed.data, include: withPhotos });
    res.json({ listing: toListing(updated, storage) });
  });

  router.post("/:id/photos", auth(["LANDLORD", "ADMIN"]), upload.array("photos", MAX_PHOTOS), async (req, res) => {
    const property = await prisma.property.findUnique({
      where: { id: String(req.params.id) },
      include: { _count: { select: { photos: true } } },
    });
    if (!property || !canManage(req.user, property)) return sendError(res, 404, "Listing not found");

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) return sendError(res, 400, "Choose at least one photo");
    if (property._count.photos + files.length > MAX_PHOTOS)
      return sendError(res, 400, `A listing can have up to ${MAX_PHOTOS} photos`);
    const exts = files.map((f) => imageExtension(f.buffer));
    if (exts.some((e) => !e)) return sendError(res, 400, "Photos must be JPG, PNG or WebP images");

    let position = property._count.photos;
    for (const [i, file] of files.entries()) {
      const key = await storage.save(file.buffer, exts[i]!);
      await prisma.photo.create({ data: { propertyId: property.id, key, position: position++ } });
    }
    const updated = await prisma.property.findUniqueOrThrow({ where: { id: property.id }, include: withPhotos });
    res.status(201).json({ listing: toListing(updated, storage) });
  });

  router.delete("/:id/photos/:photoId", auth(["LANDLORD", "ADMIN"]), async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: String(req.params.photoId) }, include: { property: true } });
    if (!photo || photo.propertyId !== String(req.params.id) || !canManage(req.user, photo.property))
      return sendError(res, 404, "Photo not found");
    await prisma.photo.delete({ where: { id: photo.id } });
    await storage.remove(photo.key);
    res.status(204).end();
  });

  router.post("/:id/applications", auth(["TENANT"]), async (req, res) => {
    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "Check the highlighted fields", zodFields(parsed.error));
    const property = await prisma.property.findUnique({ where: { id: String(req.params.id) }, include: { landlord: true } });
    if (!property || property.status !== "AVAILABLE") return sendError(res, 404, "This place is no longer available");

    const pending = await prisma.application.findFirst({
      where: { propertyId: property.id, tenantId: req.user!.id, status: "PENDING" },
    });
    if (pending) return sendError(res, 409, "You already applied for this place");

    const application = await prisma.application.create({
      data: {
        propertyId: property.id,
        tenantId: req.user!.id,
        message: parsed.data.message,
        moveInDate: parsed.data.moveInDate,
        acceptedTerms: property.terms,
        termsAcceptedAt: new Date(),
      },
      include: { property: true, tenant: { select: contactSelect } },
    });
    await notifyUser(
      notifier,
      property.landlord,
      "New application",
      `${req.user!.fullName} applied for "${property.title}" (${formatRwf(property.monthlyRent)}/month). Open your dashboard to respond.`,
    );
    res.status(201).json({ application: toApplication(application) });
  });

  return router;
}
