import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { CreateItemDto } from "./dto/create-item.dto";
import { ListItemsDto } from "./dto/list-items.dto";
import { ItemsService } from "./items.service";

@Controller("items")
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListItemsDto) {
    return this.items.list(user, query.page, query.limit, query.q, query.sort, query.dir);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateItemDto) {
    return this.items.create(user, body);
  }
}
