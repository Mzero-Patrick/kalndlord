import { Screen } from "@/components/Screen";
import { QuestionForm } from "@/components/Forms";
import { Muted, Title } from "@/components/ui";

export default function Contact() {
  return (
    <Screen>
      <Title>Contact us</Title>
      <Muted>Need help, or something to raise with the Kalndlord team? Send us a question and we'll reply here and by message.</Muted>
      <QuestionForm />
    </Screen>
  );
}
