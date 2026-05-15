import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "mission-control",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
