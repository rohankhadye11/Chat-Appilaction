import express from "express";
import cors from "cors";
import morgan from "morgan";
import { mongo } from "@app/common";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Enhance route to support range queries for reconciliation
app.get("/history/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const from = Number(req.query.from || 0);
  const to = Number(req.query.to || 0);
  const limit = Math.min(Number(req.query.limit) || 50, 500);

  const q: any = { chatId };
  if (from && to && to >= from) {
    q.sequence_number = { $gte: from, $lte: to };
  }

  const cursor = mongo.messages().find(q).sort({ sequence_number: 1 });
  const docs = await (limit ? cursor.limit(limit) : cursor).toArray();
  res.json(docs);
});

const PORT = Number(process.env.HISTORY_SERVICE_PORT || 3003);
mongo.connect().then(() => {
  app.listen(PORT, () => console.log(`history-service on ${PORT}`));
});
