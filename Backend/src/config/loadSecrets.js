import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

export const loadSecrets = async () => {
   // Local dev or app.yaml env var already set
   if (process.env.MONGO_URI) return;

   const projectId = process.env.GOOGLE_CLOUD_PROJECT;
   if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT is not set");
   }

   const client = new SecretManagerServiceClient();
   const name = `projects/${projectId}/secrets/mongo-uri/versions/latest`;

   const [version] = await client.accessSecretVersion({ name });
   const uri = version.payload?.data?.toString("utf8");

   if (!uri) {
      throw new Error("mongo-uri secret payload is empty");
   }

   process.env.MONGO_URI = uri;
};
