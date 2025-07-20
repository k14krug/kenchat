import { UserResponse } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: UserResponse;
      token?: string;
    }
  }
}