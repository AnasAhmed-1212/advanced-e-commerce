import { NextResponse } from "next/server";
import { databaseConfigured } from "../../../../lib/db";
import { customerAuthConfigured,getCustomerSession } from "../../../../lib/customer-auth";
import { getCustomerAccount } from "../../../../lib/customers-repository";
export async function GET(){const configured=databaseConfigured()&&customerAuthConfigured();if(!configured)return NextResponse.json({configured:false,authenticated:false,user:null,orders:[]});const session=await getCustomerSession();if(!session)return NextResponse.json({configured:true,authenticated:false,user:null,orders:[]});try{const account=await getCustomerAccount(session.userId);return account?NextResponse.json({configured:true,authenticated:true,...account},{headers:{"Cache-Control":"private, no-store"}}):NextResponse.json({configured:true,authenticated:false,user:null,orders:[]})}catch{return NextResponse.json({error:"Unable to load account."},{status:500})}}
