import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import nextEnv from "@next/env";
import pg from "pg";
import sharp from "sharp";
import { chromium, expect as baseExpect } from "@playwright/test";
import { dropTestSchema } from "./test-database.mjs";
const expect=baseExpect.configure({timeout:30000});
nextEnv.loadEnvConfig(process.cwd(),true);
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const schema=`commerce_test_${randomUUID().replaceAll("-","")}`;
const originalUrl=new URL(process.env.DATABASE_URL),ssl=process.env.DATABASE_SSL==="true"?{rejectUnauthorized:false}:undefined;
const rootPool=new pg.Pool({connectionString:originalUrl.toString(),ssl,max:1,connectionTimeoutMillis:20000});
const url=new URL(originalUrl);url.searchParams.set("options",`-c search_path=${schema},public,extensions`);
const testPool=new pg.Pool({connectionString:url.toString(),ssl,max:2,connectionTimeoutMillis:20000});
let server,browser,debugPage,created=false,serverOutput="";
const fixtureManifest="test-results/active-schema.json";
for(const pool of [rootPool,testPool])pool.on("error",error=>console.error("Test connection closed:",error.code||"CONNECTION_ERROR"));
const messages=[];
const testPassword=randomBytes(18).toString("base64url"),salt=randomBytes(16).toString("hex");
const testHash=`${salt}:${scryptSync(testPassword,salt,64).toString("hex")}`;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  fs.mkdirSync("test-results",{recursive:true});
  if(fs.existsSync(fixtureManifest)){
    const previous=JSON.parse(fs.readFileSync(fixtureManifest,"utf8"));
    assert(/^commerce_test_[a-f0-9]{32}$/.test(previous.schema)&&previous.owner==="test-commerce");
    await dropTestSchema(rootPool,previous.schema);
    fs.unlinkSync(fixtureManifest);
  }
  fs.writeFileSync(fixtureManifest,JSON.stringify({schema,owner:"test-commerce"}));
  await rootPool.query(`CREATE SCHEMA ${schema}`);created=true;
  const client=await testPool.connect();
  try{
    assert.equal((await client.query("SELECT current_schema() AS schema")).rows[0].schema,schema);
    await client.query("BEGIN");
    for(const name of fs.readdirSync("database").filter(name=>/^\d+_.*\.sql$/.test(name)).sort())await client.query(fs.readFileSync(`database/${name}`,"utf8"));
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  const port=await new Promise((resolve,reject)=>{const socket=net.createServer();socket.once("error",reject);socket.listen(0,"127.0.0.1",()=>{const port=socket.address().port;socket.close(()=>resolve(port));});});
  const base=`http://localhost:${port}`;
  server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--port",String(port),"--hostname","127.0.0.1"],{cwd:process.cwd(),env:{...process.env,NODE_ENV:"production",DATABASE_URL:url.toString(),ADMIN_EMAIL:"admin@commerce-test.invalid",ADMIN_PASSWORD_HASH:testHash,ADMIN_SESSION_SECRET:randomBytes(32).toString("hex"),CUSTOMER_SESSION_SECRET:randomBytes(32).toString("hex")},stdio:["ignore","pipe","pipe"]});
  for(const stream of [server.stdout,server.stderr])stream.on("data",data=>{serverOutput=(serverOutput+data).slice(-10000);});
  let ready=false;
  for(let i=0;i<80;i++){if(server.exitCode!==null)throw new Error("Test server exited.");try{if((await fetch(`${base}/api/v1/catalog`)).ok){ready=true;break;}}catch{}await pause(500);}
  assert(ready,"Test server did not start");
  assert.equal((await fetch(`${base}/api/v1/admin/categories`)).status,401);
  assert.equal((await fetch(new URL("/api/v1/admin/customers",base))).status,401);
  assert.equal((await fetch(new URL("/api/v1/admin/visitors",base))).status,401);
  const browserPath=process.env.COMMERCE_BROWSER_PATH||["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe","C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(file=>fs.existsSync(file));
  browser=await chromium.launch({headless:true,...(browserPath?{executablePath:browserPath}:{})});
  const admin=await browser.newContext({baseURL:base,viewport:{width:1440,height:1000}}),page=await admin.newPage();
  debugPage=page;page.on("pageerror",error=>messages.push(error.message));
  await page.goto(`${base}/admin`);
  await page.getByLabel("Email address").fill("admin@commerce-test.invalid");
  await page.getByLabel("Password",{exact:true}).fill(testPassword);
  await page.getByRole("button",{name:"Sign in securely"}).click();
  await expect(page.getByRole("heading",{name:"Overview",exact:true})).toBeVisible();
  console.log("PASS: admin authentication and unauthorized API protection");
  async function adminApi(route,method="GET",data){
    const response=await admin.request.fetch(`${base}${route}`,{method,...(data!==undefined?{data}:{}),headers:{origin:base}});
    const body=await response.json();return{response,body};
  }
  const customerEmail = "customer-account-test@example.invalid";
  const registeredContext = await browser.newContext({baseURL:base});
  const registration = await registeredContext.request.post("/api/v1/account/register", { data: {email:customerEmail,password:testPassword+"a1",firstName:"Test",lastName:"Customer"} });
  assert.equal(registration.status(),201);
  const customerPage = await registeredContext.newPage();
  await customerPage.goto(base);
  await expect(customerPage.locator("[data-store-header]").getByRole("link",{name:"My account",exact:true})).toBeVisible();
  await expect(customerPage.locator("[data-store-header]").getByRole("link",{name:"Sign in",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Customers",exact:true}).click();
  await expect(page.getByRole("cell",{name:customerEmail,exact:true})).toBeVisible();
  const visitReport = async () => (await adminApi("/api/v1/admin/visitors")).body;
  await expect.poll(async () => (await visitReport()).activity?.some(entry => entry.kind === "page_view" && entry.path === "/")).toBe(true);
  const initialReport = await visitReport();
  assert.equal(initialReport.active,1);
  assert.equal(initialReport.total,1);
  await page.getByRole("button",{name:"Visitors",exact:true}).click();
  await expect(page.getByRole("cell",{name:"Page viewed",exact:true})).toBeVisible();
  await registeredContext.close();
  await page.getByRole("button",{name:"Categories",exact:true}).click();
  await page.getByRole("button",{name:"+ Add category",exact:true}).click();
  const categoryDialog=page.getByRole("dialog");
  await categoryDialog.getByLabel("Category name").fill("Test Essentials");
  await categoryDialog.getByLabel("Description",{exact:true}).fill("A category description saved in PostgreSQL.");
  const raw=Buffer.alloc(1800*1200*3);
  for(let y=0;y<1200;y++)for(let x=0;x<1800;x++){const offset=(y*1800+x)*3;raw[offset]=Math.round(x/1800*255);raw[offset+1]=Math.round(y/1200*255);raw[offset+2]=Math.round((x+y)/3000*255);}
  const image=await sharp(raw,{raw:{width:1800,height:1200,channels:3}}).png({compressionLevel:0}).toBuffer();
  const secondImage=await sharp({create:{width:800,height:800,channels:3,background:"#62a386"}}).png().toBuffer();
  await categoryDialog.locator('input[type="file"]').setInputFiles({name:"category.png",mimeType:"image/png",buffer:image});
  await expect(categoryDialog.locator(".upload-image")).toHaveCount(1,{timeout:60000});
  await expect(categoryDialog.getByRole("button",{name:"Save category",exact:true})).toBeEnabled();
  await categoryDialog.getByRole("button",{name:"Save category",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const categories=(await adminApi("/api/v1/admin/categories")).body.categories;
  assert(Array.isArray(categories),"Category API did not return a catalog");assert.equal(categories.length,1);const category=categories[0];assert.equal(category.description,"A category description saved in PostgreSQL.");
  assert(category.image.width<=1600&&category.image.height<=1600);assert(category.image.sizeBytes<image.length);
  const imageResponse=await fetch(`${base}${category.image.url}`);assert.equal(imageResponse.headers.get("content-type"),"image/webp");
  assert.equal((await sharp(Buffer.from(await imageResponse.arrayBuffer())).metadata()).format,"webp");
  console.log("PASS: category image/description creation and server-side image compression");
  await page.getByRole("button",{name:"Products",exact:true}).click();
  await page.getByRole("button",{name:"+ Add product",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("Product name").fill("Test Everyday Product");
  await dialog.getByLabel("Description",{exact:true}).fill("A real product description.\nSecond line with useful details.");
  await dialog.getByLabel("Current price (PKR)",{exact:true}).fill("1299.50");
  await dialog.getByLabel("Previous price (PKR, optional)",{exact:true}).fill("1499.50");
  await dialog.getByLabel("Total stock").fill("3");
  await dialog.getByLabel("Visibility").selectOption("published");
  assert.equal(await dialog.getByLabel("SKU",{exact:true}).count(),0);
  await dialog.locator('input[type="file"]').setInputFiles([{name:"front.png",mimeType:"image/png",buffer:image},{name:"detail.png",mimeType:"image/png",buffer:secondImage}]);
  await expect(dialog.locator(".upload-image")).toHaveCount(2,{timeout:60000});
  await expect(dialog.getByRole("button",{name:"Save product",exact:true})).toBeEnabled();
  const firstUrl=await dialog.locator(".upload-image img").nth(0).getAttribute("src"),secondUrl=await dialog.locator(".upload-image img").nth(1).getAttribute("src");
  await dialog.locator(".upload-image").nth(0).dragTo(dialog.locator(".upload-image").nth(1));
  await expect(dialog.locator(".upload-image img").first()).toHaveAttribute("src",secondUrl);
  await dialog.getByRole("button",{name:"Save product",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let product=(await adminApi("/api/v1/admin/products")).body.products[0];
  assert.equal(product.images[0].url,secondUrl);assert.equal(product.images[1].url,firstUrl);assert.equal(product.priceMinor,129950);assert.equal(product.previousPriceMinor,149950);assert.equal(product.categoryId,category.id);
  fs.mkdirSync("test-results",{recursive:true});await page.screenshot({path:"test-results/admin-products.png",fullPage:true});
  const productInput={title:product.title,slug:product.slug,description:product.description,categoryId:product.categoryId,priceMinor:product.priceMinor,onHand:3,status:"published",imageIds:product.images.map(i=>i.id),version:product.version};
  assert.equal((await adminApi(`/api/v1/admin/products/${product.id}`,"PATCH",productInput)).response.status(),200);
  assert.equal((await adminApi(`/api/v1/admin/products/${product.id}`,"PATCH",productInput)).response.status(),409);
  assert.equal((await adminApi(`/api/v1/admin/categories/${category.id}`,"DELETE")).response.status(),409);
  console.log("PASS: SKU-free product creation, multiple images, drag ordering, editing and stale-edit protection");
  const invalidForm=new FormData();invalidForm.set("file",new Blob(["<svg xmlns='http://www.w3.org/2000/svg'></svg>"],{type:"image/svg+xml"}),"invalid.svg");
  const cookie=(await admin.cookies()).map(c=>`${c.name}=${c.value}`).join("; ");
  assert.equal((await fetch(`${base}/api/v1/admin/uploads`,{method:"POST",headers:{cookie,origin:base},body:invalidForm})).status,400);
  const shop=await browser.newContext({baseURL:base,viewport:{width:1440,height:1000}}),customer=await shop.newPage();customer.on("pageerror",error=>messages.push(error.message));debugPage=customer;
  const email="customer@commerce-test.invalid",customerPassword=randomBytes(16).toString("base64url")+"7";
  await customer.goto(`${base}/account`);await customer.getByRole("button",{name:"Create account",exact:true}).first().click();
  await customer.getByLabel("First name").fill("Test");await customer.getByLabel("Last name").fill("Customer");await customer.getByLabel("Email address").fill(email);await customer.getByLabel("Password",{exact:true}).fill(customerPassword);
  await customer.locator("form").getByRole("button",{name:"Create account",exact:true}).click();await expect(customer.getByRole("heading",{name:"Hello, Test."})).toBeVisible();
  await customer.goto(base);await expect(customer.getByRole("link",{name:product.title,exact:true}).last()).toBeVisible();await expect(customer.locator(".circle-grid").getByRole("button",{name:/Test Essentials/}).first()).toBeVisible();
  await customer.locator(".deal-image").first().scrollIntoViewIfNeeded();
  await expect.poll(()=>customer.locator(".circle-grid img").first().evaluate(image=>image.naturalWidth),{timeout:60000}).toBeGreaterThan(0);
  await expect.poll(()=>customer.locator(".deal-image img").first().evaluate(image=>image.naturalWidth),{timeout:60000}).toBeGreaterThan(0);
  await customer.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
  await customer.screenshot({path:"test-results/storefront.png",fullPage:true});
  await customer.getByRole("link",{name:product.title,exact:true}).last().click();await expect(customer.getByRole("heading",{name:product.title,exact:true})).toBeVisible();
  await customer.getByRole("button",{name:"View image 2",exact:true}).click();await expect(customer.locator(".gallery-main img")).toHaveAttribute("src",firstUrl);
  await expect.poll(()=>customer.locator(".gallery-main img").evaluate(image=>image.naturalWidth),{timeout:60000}).toBeGreaterThan(0);
  await customer.getByRole("button",{name:"Increase quantity"}).click();await customer.getByRole("button",{name:"Add to cart",exact:true}).click();
  const cartDrawer = customer.getByRole("dialog",{name:/Your cart/});
  await expect(cartDrawer).toBeVisible();
  await expect(cartDrawer.getByRole("heading",{name:"Your cart (2)"})).toBeVisible();
  await cartDrawer.getByRole("link",{name:"Continue to checkout",exact:true}).click();await expect(customer.locator(".cart-line")).toHaveCount(1);await customer.reload();await expect(customer.locator(".line-quantity span")).toHaveText("2");
  let submitted,lostResponse=false;
  await customer.route("**/api/v1/checkout/orders",async route=>{
    if(!lostResponse){lostResponse=true;const response=await route.fetch();if(response.status()===201){await route.abort("failed");return;}await route.fulfill({response});return;}
    await route.continue();
  });
  customer.on("request",request=>{if(request.method()==="POST"&&new URL(request.url()).pathname==="/api/v1/checkout/orders")submitted={key:request.headers()["idempotency-key"],body:request.postDataJSON()};});
  async function delivery(method){
    await customer.getByRole("button",{name:"Continue to delivery",exact:true}).click();
    for(const[label,value]of [["Email address",email],["Phone number","03000000000"],["First name","Test"],["Last name","Customer"],["Street address","Test address"],["City","Karachi"],["Postal code","74000"]])await customer.getByLabel(label,{exact:true}).fill(value);
    await customer.getByRole("radio",{name:method==="cod"?/Cash on delivery/:/Raast bank transfer/}).check();
    await customer.getByRole("button",{name:"Place order",exact:true}).click();
    await expect(customer.getByText("Order received",{exact:true})).toBeVisible().catch(async error => {
      const message = await customer.locator(".checkout-main .form-error").allTextContents();
      throw new Error(message.join(" ") || error.message);
    });
    return customer.evaluate(()=>JSON.parse(sessionStorage.getItem("northstar-order-confirmation")));
  }
  const cod=await delivery("cod");
  await expect.poll(async () => (await visitReport()).activity?.map(entry => entry.kind)).toEqual(expect.arrayContaining(["account_registered","add_to_cart","checkout_started","order_placed"]));assert.equal(cod.totalMinor,324900);assert.equal(cod.paymentMethod,"cod");
  let dbOrder=(await testPool.query("SELECT * FROM orders WHERE id=$1",[cod.orderId])).rows[0];assert.equal(dbOrder.payment_status,"unpaid");assert(dbOrder.user_id);
  const replay=await fetch(`${base}/api/v1/checkout/orders`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":submitted.key,origin:base},body:JSON.stringify(submitted.body)});assert.equal(replay.status,201);assert.equal((await replay.json()).orderId,cod.orderId);
  const failed=await fetch(`${base}/api/v1/checkout/orders`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":randomUUID(),origin:base},body:JSON.stringify(submitted.body)});assert.equal(failed.status,409);
  assert.equal((await testPool.query("SELECT count(*)::int AS count FROM orders")).rows[0].count,1);
  let stock=(await testPool.query("SELECT on_hand,reserved FROM inventory_stock")).rows[0];assert.deepEqual(stock,{on_hand:3,reserved:2});
  const lastUnit={...submitted.body,items:[{productId:product.id,quantity:1}],expectedTotalMinor:194950};
  const raced=await Promise.all([0,1].map(async()=>{
    const response=await fetch(`${base}/api/v1/checkout/orders`,{method:"POST",headers:{"content-type":"application/json","idempotency-key":randomUUID(),origin:base},body:JSON.stringify(lastUnit)});
    return{status:response.status,body:await response.json()};
  }));
  assert.deepEqual(raced.map(result=>result.status).sort(),[201,409]);
  const winner=raced.find(result=>result.status===201);
  assert.equal((await adminApi(`/api/v1/admin/orders/${winner.body.orderId}`,"PATCH",{orderStatus:"cancelled"})).response.status(),200);
  stock=(await testPool.query("SELECT on_hand,reserved FROM inventory_stock")).rows[0];assert.deepEqual(stock,{on_hand:3,reserved:2});
  console.log("PASS: customer registration, live storefront/gallery, cart persistence, COD checkout, cents, recovery from a lost response, idempotency and concurrent last-unit stock protection");
  await adminApi(`/api/v1/admin/orders/${cod.orderId}`,"PATCH",{paymentStatus:"paid",fulfillmentStatus:"delivered"});
  stock=(await testPool.query("SELECT on_hand,reserved FROM inventory_stock")).rows[0];assert.deepEqual(stock,{on_hand:1,reserved:0});
  await adminApi(`/api/v1/admin/orders/${cod.orderId}`,"PATCH",{fulfillmentStatus:"returned"});
  await adminApi(`/api/v1/admin/orders/${cod.orderId}`,"PATCH",{fulfillmentStatus:"returned"});
  stock=(await testPool.query("SELECT on_hand,reserved FROM inventory_stock")).rows[0];assert.deepEqual(stock,{on_hand:3,reserved:0});
  console.log("PASS: delivered stock deduction and returned stock restoration happen exactly once");
  await page.getByRole("button",{name:"Payments",exact:true}).click();
  await page.getByLabel("Enable Raast bank transfer at checkout").check();
  await page.getByLabel("Account title").fill("Commerce Test Receiver");await page.getByLabel("Raast ID, account number or IBAN").fill("TEST-ACCOUNT-NOT-FOR-PAYMENT");await page.getByLabel("Bank name").fill("Test Bank");
  await page.getByRole("button",{name:"Save payment settings",exact:true}).click();await expect(page.getByText("Payment settings saved.")).toBeVisible();
  await customer.goto(`${base}/products/${product.slug}`);await customer.getByRole("button",{name:"Add to cart",exact:true}).click();await cartDrawer.getByRole("link",{name:"Continue to checkout",exact:true}).click();
  const raast=await delivery("raast");assert.equal(raast.paymentMethod,"raast");assert.equal(raast.paymentDetails.accountNumber,"TEST-ACCOUNT-NOT-FOR-PAYMENT");
  await customer.getByLabel("Bank transaction / transfer reference").fill("TEST-TRANSFER-REFERENCE-001");await customer.getByRole("button",{name:"Submit transfer reference",exact:true}).click();await expect(customer.getByText("Reference submitted.",{exact:false})).toBeVisible();
  dbOrder=(await testPool.query("SELECT payment_status,payment_reference FROM orders WHERE id=$1",[raast.orderId])).rows[0];assert.equal(dbOrder.payment_status,"pending");assert.equal(dbOrder.payment_reference,"TEST-TRANSFER-REFERENCE-001");
  const invalidReference=await fetch(`${base}/api/v1/checkout/orders/${raast.orderId}/payment-reference`,{method:"POST",headers:{"content-type":"application/json",origin:base},body:JSON.stringify({token:"0".repeat(64),reference:"INVALID-REFERENCE"})});assert.equal(invalidReference.status,403);
  await page.getByRole("button",{name:"Orders",exact:true}).click();await page.getByRole("button",{name:raast.orderNumber,exact:true}).click();await expect(page.getByText("TEST-TRANSFER-REFERENCE-001",{exact:true})).toBeVisible();
  await page.getByRole("dialog").getByRole("combobox").nth(1).selectOption("paid");await expect.poll(async()=>(await testPool.query("SELECT payment_status FROM orders WHERE id=$1",[raast.orderId])).rows[0].payment_status).toBe("paid");
  await page.screenshot({path:"test-results/admin-raast-order.png",fullPage:true});
  await expect(page.getByRole("dialog").getByRole("combobox").first()).toBeEnabled();await page.getByRole("button",{name:"Close order",exact:true}).click();
  await adminApi(`/api/v1/admin/orders/${raast.orderId}`,"PATCH",{orderStatus:"cancelled"});await adminApi(`/api/v1/admin/orders/${raast.orderId}`,"PATCH",{orderStatus:"cancelled"});
  stock=(await testPool.query("SELECT on_hand,reserved FROM inventory_stock")).rows[0];assert.deepEqual(stock,{on_hand:3,reserved:0});assert.equal((await adminApi(`/api/v1/admin/orders/${raast.orderId}`,"PATCH",{orderStatus:"confirmed"})).response.status(),409);
  console.log("PASS: Raast settings, transfer instructions/reference, payment verification and cancellation stock release");
  await customer.setViewportSize({width:390,height:844});await customer.goto(base);await expect(customer.getByRole("link",{name:product.title,exact:true}).last()).toBeVisible();
  await customer.locator(".deal-image").first().scrollIntoViewIfNeeded();
  await expect.poll(()=>customer.locator(".circle-grid img").first().evaluate(image=>image.naturalWidth),{timeout:60000}).toBeGreaterThan(0);
  await expect.poll(()=>customer.locator(".deal-image img").first().evaluate(image=>image.naturalWidth),{timeout:60000}).toBeGreaterThan(0);
  await customer.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
  assert(await customer.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"Mobile storefront overflows horizontally");await customer.screenshot({path:"test-results/storefront-mobile.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.getByRole("button",{name:"Toggle navigation"}).click();await page.getByRole("button",{name:"Products",exact:true}).click();await page.getByRole("button",{name:"Edit",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.getByRole("button",{name:"Move image 2 earlier",exact:true}).click();await expect(page.locator(".upload-image img").first()).toHaveAttribute("src",firstUrl);await page.getByRole("button",{name:"Save product",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
  // Additional UI fixtures are created only after the stock/accounting checks above.
  debugPage=customer;
  const uiProducts=[];
  for(let i=1;i<=8;i++){
    const title=`UI Equipment ${i} Home Care Medical Device`;
    const result=await adminApi("/api/v1/admin/products","POST",{title,slug:`ui-equipment-${i}`,description:`UI fixture ${i}.\nModel-specific information supplied by the store.`,categoryId:category.id,priceMinor:200000+i*12500,deliveryChargeMinor:i===1?0:45000,onHand:i===8?0:4,status:"published",imageIds:product.images.map(image=>image.id)});
    assert.equal(result.response.status(),201);uiProducts.push({id:result.body.id,title,slug:`ui-equipment-${i}`});
  }
  await customer.addInitScript(()=>{
    Object.defineProperty(navigator,"share",{value:undefined,configurable:true});
    Object.defineProperty(navigator,"clipboard",{value:{writeText:async text=>{window.__sharedProductLink=text;}},configurable:true});
  });
  await customer.setViewportSize({width:1440,height:1000});await customer.goto(base);
  await expect(customer.locator(".deal-grid > .deal-card")).toHaveCount(9);
  assert.equal(await customer.locator(".deal-grid").evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(/\s+/).length),5);
  const firstCard=customer.locator(".deal-grid > .deal-card").filter({hasText:uiProducts[0].title});
  await expect(firstCard.locator(".deal-image").getByText("Free delivery",{exact:true})).toBeVisible();
  const paidCard = customer.locator(".deal-grid > .deal-card").filter({hasText:uiProducts[1].title});
  await expect(paidCard.getByText("Free delivery",{exact:true})).toHaveCount(0);
  await firstCard.getByRole("button",{name:"Add to cart",exact:true}).click();
  await expect(cartDrawer.getByText("Free",{exact:true})).toBeVisible();
  await cartDrawer.getByRole("button",{name:"Remove "+uiProducts[0].title,exact:true}).click();
  await expect(cartDrawer.getByRole("heading",{name:"Your cart is empty"})).toBeVisible();
  await customer.keyboard.press("Escape");
  await expect(cartDrawer).toHaveCount(0);
  const mixed = await customer.request.post("/api/v1/checkout/quote",{data:{items:[{productId:uiProducts[0].id,quantity:1},{productId:uiProducts[1].id,quantity:2}]}});
  assert.equal(mixed.status(),200);
  assert.equal((await mixed.json()).shippingMinor,45000);
  await firstCard.scrollIntoViewIfNeeded();await firstCard.locator(".deal-image a").hover({position:{x:30,y:35}});
  await expect.poll(()=>firstCard.locator(".deal-image img").evaluate(image=>getComputedStyle(image).transform)).not.toBe("none");
  assert(await firstCard.locator(".deal-image").evaluate(el=>el.style.getPropertyValue("--zoom-x").length>0));
  const enlarge=firstCard.getByRole("button",{name:`Enlarge ${uiProducts[0].title}`,exact:true});await enlarge.click();
  await expect(customer.getByRole("dialog",{name:`Images of ${uiProducts[0].title}`})).toBeVisible();await customer.getByRole("button",{name:"Zoom in",exact:true}).click();await expect(customer.getByRole("button",{name:"Zoom out",exact:true})).toBeVisible();await customer.keyboard.press("Escape");await expect(customer.getByRole("dialog")).toHaveCount(0);await expect(enlarge).toBeFocused();
  await firstCard.getByRole("button",{name:`Save ${uiProducts[0].title}`,exact:true}).click();await expect(firstCard.getByRole("button",{name:`Unsave ${uiProducts[0].title}`,exact:true})).toHaveAttribute("aria-pressed","true");
  await customer.locator(".deal-grid").screenshot({path:"test-results/product-cards-desktop.png"});
  await customer.setViewportSize({width:390,height:844});assert.equal(await customer.locator(".deal-grid").evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(/\s+/).length),2);assert(await customer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await customer.locator(".deal-grid").screenshot({path:"test-results/product-cards-mobile.png"});
  await customer.setViewportSize({width:1440,height:1000});await firstCard.locator(".deal-name").click();
  await expect(customer.getByRole("heading",{name:uiProducts[0].title,exact:true})).toBeVisible();const information=customer.getByRole("region",{name:"Product information",exact:true});
  await expect(information.getByRole("button",{name:"Remove from wishlist",exact:true})).toBeVisible();await customer.getByRole("button",{name:"View image 2",exact:true}).click();await expect(customer.locator(".gallery-main img")).toHaveAttribute("src",firstUrl);
  await customer.locator(".gallery-main img").hover();await expect.poll(()=>customer.locator(".gallery-main img").evaluate(image=>getComputedStyle(image).transform)).not.toBe("none");
  await customer.getByRole("button",{name:"Open full-screen gallery",exact:true}).click();await customer.getByRole("button",{name:"Previous image",exact:true}).click();await expect(customer.getByRole("dialog")).toContainText("Image 1 of 2");await customer.keyboard.press("Escape");
  await customer.getByRole("button",{name:"Share",exact:true}).click();await expect.poll(()=>customer.evaluate(()=>window.__sharedProductLink)).toBe(`${base}/products/${uiProducts[0].slug}`);
  await expect(information.getByRole("link",{name:"Make an offer / Enquire",exact:true})).toHaveAttribute("href",/^https:\/\/wa\.me\/923310170118\?text=/);
  await customer.screenshot({path:"test-results/product-detail-desktop.png",fullPage:true});
  await information.getByRole("button",{name:"Increase quantity",exact:true}).click();await information.getByRole("button",{name:"Buy now",exact:true}).click();await expect(customer).toHaveURL(/\/checkout$/);await expect(customer.locator(".line-quantity span")).toHaveText("2");await customer.locator(".cart-line").getByRole("button",{name:"Remove",exact:true}).click();
  await customer.goto(`${base}/products/${uiProducts[1].slug}`);await expect(customer.getByRole("region",{name:"Recently viewed",exact:true}).getByRole("link",{name:uiProducts[0].title,exact:true})).toBeVisible();
  await customer.setViewportSize({width:390,height:844});assert(await customer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await customer.screenshot({path:"test-results/product-detail-mobile.png",fullPage:true});
  await customer.goto(`${base}/products/${uiProducts[7].slug}`);await expect(customer.getByRole("region",{name:"Product information",exact:true}).getByRole("button",{name:"Out of stock",exact:true})).toBeDisabled();
  console.log("PASS: five/two-column product cards, cursor zoom, modal zoom/Escape/focus, shared wishlist, detail thumbnails, sharing, Buy now, recent products, mobile detail and sold-out protection");
  const categoryUpdate=await adminApi(`/api/v1/admin/categories/${category.id}`,"PATCH",{name:category.name,slug:category.slug,description:category.description,imageId:category.image.id,isActive:false});assert.equal(categoryUpdate.response.status(),200);
  const hidden=(await(await fetch(`${base}/api/v1/catalog`)).json());assert.equal(hidden.products.length,0);assert.equal(hidden.categories.length,0);
  assert.equal(messages.length,0,`Browser errors: ${messages.join("; ")}`);
  console.log("PASS: responsive storefront, mobile image reordering, category visibility and no browser runtime errors");
  console.log("All commerce end-to-end checks passed. Screenshots saved in test-results/.");
  fs.rmSync("test-results/failure.png",{force:true});
}catch(error){
  if(debugPage){fs.mkdirSync("test-results",{recursive:true});await debugPage.screenshot({path:"test-results/failure.png",fullPage:true}).catch(()=>{});}
  console.error(error.stack||error.message);
  if(serverOutput)console.error("Test server output:",serverOutput.replaceAll(originalUrl.toString(),"[DATABASE_URL]").replaceAll(url.toString(),"[TEST_DATABASE_URL]"));
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  if(server){server.kill();await Promise.race([new Promise(resolve=>server.once("exit",resolve)),pause(3000)]);}
  await testPool.end();
  if(created){
    assert(/^commerce_test_[a-f0-9]{32}$/.test(schema));
    try{await dropTestSchema(rootPool,schema);fs.rmSync(fixtureManifest,{force:true});console.log("Isolated test schema removed.");}
    catch(error){console.error("Temporary schema cleanup will retry on the next test run:",error.code||"CONNECTION_TIMEOUT");process.exitCode=1;}
  }
  await rootPool.end();
}
