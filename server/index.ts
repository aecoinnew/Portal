import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config();

const port = Number(process.env.API_PORT ?? 4000);

createApp().listen(port, () => {
  console.log(`Emcoin API listening on http://localhost:${port}`);
});
