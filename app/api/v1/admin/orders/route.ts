import { NextResponse } from "next/server";
import { databaseConfigured } from "../../../../lib/db";
import { getAdminSession } from "../../../../lib/admin-session";
import { listAdminOrders } from "../../../../lib/orders-repository";
export async function GET(){if(!(await getAdminSession()))return NextResponse.json({error:"Unauthorized"},{status:401});if(!databaseConfigured())return NextResponse.json({error:"PostgreSQL is not configured.",code:"DATABASE_NOT_CONFIGURED"},{status:503});try{return NextResponse.json({orders:await listAdminOrders()})}catch{return NextResponse.json({error:"Unable to load orders."},{status:500})}}
