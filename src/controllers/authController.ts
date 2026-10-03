import { Body, Controller, Post, Route, SuccessResponse, Tags } from "tsoa";

import { login, register, type PublicUser } from "../services/authService";

interface RegisterBody {
  username: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface AuthResponse {
  user: PublicUser;
  token: string;
}

@Route("auth")
@Tags("Authentication")
export class AuthController extends Controller {
  @Post("register")
  @SuccessResponse("201", "Registered")
  public async register(@Body() body: RegisterBody): Promise<AuthResponse> {
    const result = await register(body.username, body.email, body.password);
    this.setStatus(201);
    return result;
  }

  @Post("login")
  public async login(@Body() body: LoginBody): Promise<AuthResponse> {
    return login(body.email, body.password);
  }
}
