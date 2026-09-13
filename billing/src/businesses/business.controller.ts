import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Response } from "express";
import { CurrentUser } from "../common/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { BusinessService } from "./business.service";
import { UpdateBusinessDto } from "./dto/update-business.dto";

@Controller("business")
@UseGuards(JwtAuthGuard)
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.business.get(user);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() body: UpdateBusinessDto) {
    return this.business.update(user, body);
  }

  @Post(":kind")
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param("kind") kind: string,
    @UploadedFile() file?: { mimetype: string; buffer: Buffer; size: number },
  ) {
    if (kind !== "logo" && kind !== "signature" && kind !== "qr") {
      throw new NotFoundException({ error: "not_found", message: "Not found" });
    }
    return this.business.saveAsset(user, kind, file);
  }

  @Get(":kind")
  async file(
    @CurrentUser() user: AuthUser,
    @Param("kind") kind: string,
    @Res() res: Response,
  ) {
    if (kind !== "logo" && kind !== "signature" && kind !== "qr") {
      return res.status(404).json({
        statusCode: 404,
        error: { code: "not_found", message: "Not found" },
      });
    }
    const asset = await this.business.assetFile(user, kind);
    res.setHeader("Content-Type", asset.mime);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    return res.sendFile(asset.filePath);
  }
}
