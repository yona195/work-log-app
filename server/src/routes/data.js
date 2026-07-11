import { Router } from "express";
import {
  COLLECTIONS,
  createItem,
  deleteItem,
  getData,
  importAll,
  updateItem,
} from "../db.js";

const router = Router();

function assertCollection(req, res, next) {
  const { collection } = req.params;
  if (!COLLECTIONS[collection]) {
    return res.status(404).json({ error: `Unknown collection: ${collection}` });
  }
  next();
}

// Wrap async handlers so rejections reach the error middleware.
const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// Full snapshot of every collection — used for the initial load.
router.get(
  "/data",
  wrap(async (req, res) => {
    res.json(await getData());
  })
);

// Bulk replace everything (migration / restore).
router.post(
  "/import",
  wrap(async (req, res) => {
    res.json(await importAll(req.body || {}));
  })
);

router.post(
  "/:collection",
  assertCollection,
  wrap(async (req, res) => {
    const item = await createItem(req.params.collection, req.body || {});
    res.status(201).json(item);
  })
);

router.put(
  "/:collection/:id",
  assertCollection,
  wrap(async (req, res) => {
    const item = await updateItem(
      req.params.collection,
      req.params.id,
      req.body || {}
    );
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  })
);

router.delete(
  "/:collection/:id",
  assertCollection,
  wrap(async (req, res) => {
    const ok = await deleteItem(req.params.collection, req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).end();
  })
);

export default router;
