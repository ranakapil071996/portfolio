import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { ListCustomersDto } from "./dto/list-customers.dto";
import { CustomersService } from "./customers.service";

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListCustomersDto) {
    return this.customers.list(user, query.page, query.limit, query.q, query.sort, query.dir);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.customers.findOne(user, id);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateCustomerDto) {
    return this.customers.create(user, body);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: CreateCustomerDto) {
    return this.customers.update(user, id, body);
  }

  @Delete(":id")
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.customers.remove(user, id);
  }
}
