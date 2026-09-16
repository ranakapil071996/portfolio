import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { InvoicePdfQueryDto } from "./dto/invoice-pdf-query.dto";
import { ListInvoicesDto } from "./dto/list-invoices.dto";
import { InvoicesService } from "./invoices.service";

@Controller("invoices")
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListInvoicesDto) {
    return this.invoices.list(user, query.page, query.limit);
  }

  @Get("templates")
  templates(@CurrentUser() user: AuthUser) {
    return this.invoices.templates(user);
  }

  @Get(":id/pdf")
  async pdf(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query() query: InvoicePdfQueryDto,
    @Res() res: Response,
  ) {
    const file = await this.invoices.pdf(user, id, query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.invoices.findOne(user, id);
  }

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthUser, @Body() body: CreateInvoiceDto) {
    return this.invoices.create(user, body);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() body: CreateInvoiceDto) {
    return this.invoices.update(user, id, body);
  }

  @Delete(":id")
  @HttpCode(200)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.invoices.remove(user, id);
  }
}
