import { Router, type IRouter } from "express";
import evomonRouter from "./evomon";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);
router.use(evomonRouter);

export default router;
