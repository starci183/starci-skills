import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AbstractException } from '../../../../modules/platform/errors';
import { SignInUseCase } from '../../application/sign-in.use-case';
import { SignInRequest } from './dto/sign-in.request';
import { SignInResponse } from './dto/sign-in.response';

@Controller('auth')
export class SignInController {
  constructor(private readonly signInUseCase: SignInUseCase) {}

  @Post('sign-in')
  async signIn(@Body() request: SignInRequest): Promise<SignInResponse> {
    try {
      const result = await this.signInUseCase.execute({ email: request.email, password: request.password });
      return new SignInResponse(result.personId, result.sessionToken);
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
