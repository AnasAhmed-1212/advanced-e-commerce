import { NextResponse } from "next/server";
import { CUSTOMER_COOKIE } from "../../../../lib/customer-auth";
export async function POST(){const response=NextResponse.json({authenticated:false});response.cookies.set(CUSTOMER_COOKIE,"",{httpOnly:true,sameSite:"lax",path:"/",maxAge:0});return response}
