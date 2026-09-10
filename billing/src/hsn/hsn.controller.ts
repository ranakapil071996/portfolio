import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateHsnDto } from "./dto/create-hsn.dto";
import { SearchHsnDto } from "./dto/search-hsn.dto";
import { HsnService } from "./hsn.service";

@Controller("hsn")
@UseGuards(JwtAuthGuard)
export class HsnController {
  constructor(private readonly hsn: HsnService) {}

  @Get()
  @SkipThrottle()
  search(@Query() query: SearchHsnDto) {
    return this.hsn.search(query.q, query.type, query.limit);
  }

  @Post()
  @HttpCode(201)
  create(@Body() body: CreateHsnDto) {
    return this.hsn.create(body);
  }

  @Get("status")
  status() {
    return this.hsn.status();
  }
}
