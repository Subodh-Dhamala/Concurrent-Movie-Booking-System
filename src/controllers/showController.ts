import { Body, Controller, Get, Post, Route, Tags } from "tsoa";

import { Show } from "../entities/Show";
import { AppDataSource } from "../lib/database";
import { createError } from "../lib/error";

interface CreateShowBody {
  title: string;
  hall: string;
  showTime: string;
}

@Route("shows")
@Tags("Shows")
export class ShowController extends Controller {
  @Get()
  public async getShows(): Promise<Show[]> {
    return AppDataSource.getRepository(Show).find({
      relations: { seats: true },
      order: { showTime: "ASC" },
    });
  }

  @Post()
  public async createShow(@Body() body: CreateShowBody): Promise<Show> {
    const { title, hall, showTime } = body;
    if (!title.trim() || !hall.trim() || Number.isNaN(Date.parse(showTime))) {
      throw createError("A valid title, hall, and showTime are required", 400);
    }

    const repository = AppDataSource.getRepository(Show);
    const show = repository.create({
      title: title.trim(),
      hall: hall.trim(),
      showTime: new Date(showTime),
    });
    this.setStatus(201);
    return repository.save(show);
  }
}
