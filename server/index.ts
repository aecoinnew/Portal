import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config();

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 4000);

createApp().listen(port, host, () => {
  console.log(`Emcoin API listening on http://${host}:${port}`);
});
