import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRouter from "./routes/auth";
import spotifyRouter from "./routes/spotify";
import playerRouter from "./routes/player";
import lyricsRouter from "./routes/lyrics";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_URL = process.env.CLIENT_URL ?? "http://127.0.0.1:5173";

app.use(
  cors({
    origin: [CLIENT_URL, "http://127.0.0.1:5173", "http://localhost:5173"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use("/auth", authRouter);
app.use("/api/spotify", spotifyRouter);
app.use("/api/player", playerRouter);
app.use("/api/lyrics", lyricsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
