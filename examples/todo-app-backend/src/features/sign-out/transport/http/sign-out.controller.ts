import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AbstractException } from '../../../../modules/platform/errors';
import { SignOutUseCase } from '../../application/sign-out.use-case';
import { SignOutRequest } from './dto/sign-out.request';
import { SignOutResponse } from './dto/sign-out.response';

@Controller('auth')
export class SignOutController {
  constructor(private readonly signOutUseCase: SignOutUseCase) {}

  @Post('sign-out')
  async signOut(@Body() request: SignOutRequest): Promise<SignOutResponse> {
    try {
      const result = await this.signOutUseCase.execute({ sessionToken: request.sessionToken });
      return new SignOutResponse(result.signedOut);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function toHttpException(error: unknown): HttpException {
  if (error instanceof AbstractException) {
    return new HttpException(error.message, HttpStatus.UNAUTHORIZED);
  }
  return new HttpException('Unexpected error', HttpStatus.INTERNAL_SERVER_ERROR);
}
