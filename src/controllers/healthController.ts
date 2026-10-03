import { Controller, Get, Route, Tags } from "tsoa";

import { AppDataSource } from "../lib/database";

interface HealthResponse {
  status: "ok";
  database: "connected" | "not initialized";
}

@Route("health")
@Tags("Health")
export class HealthController extends Controller {
  @Get()
  public getHealth(): HealthResponse {
    return {
      status: "ok",
      database: AppDataSource.isInitialized ? "connected" : "not initialized",
    };
  }
}
