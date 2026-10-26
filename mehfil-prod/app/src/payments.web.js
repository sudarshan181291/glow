import { ApiError } from './api';
export async function buyProduct() { throw new ApiError(400, 'unsupported', 'Payments work in the Android app'); }
export async function restorePlayPurchases() {}
