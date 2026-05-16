export type SupportFormState = {
   name: string;
   email: string;
   topic: string;
   subject: string;
   message: string;
   attachment: SupportAttachment | null;
};

export type SupportAttachment = {
   name: string;
   size: number;
   type: string;
   file?: any;
};

export type SupportRequestPayload = SupportFormState;

export type SupportRequestResponse = {
   message: string;
   referenceNumber: string;
   replyToEmail: string;
   expectedResponseTime: string;
   supportEmail: string;
   emailStatus?: "sent" | "failed" | "not_configured";
};

export type SupportFaqItem = {
   id: string;
   question: string;
   answer: string;
};
