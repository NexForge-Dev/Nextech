// Needs public.legal filled in before the server starts: getPublicSettings is cached for 5 minutes.
import { test, expect } from "@playwright/test";
import { acceptCookies, deleteProduct, makeOwnProduct, setBusinessModels, svc } from "./support";
import { customerLogin, makeCustomer } from "./orders-support";

const email = `cliente-lgpd+${Date.now()}@nextech.local`;
const LEGAL = { company_name: "Loja Teste Ltda", tax_id: "11.222.333/0001-81", address: "Av. Paulista, 1000, São Paulo/SP" };
let userId: string;
let productId: string;
let previousLegal: unknown;

const profileBirthDate = async () => (await svc().from("profiles").select("birth_date").eq("id", userId).single()).data?.birth_date;

test.beforeAll(async () => {
  await setBusinessModels({ ownStore: true, affiliates: false });
  previousLegal = (await svc().from("site_settings").select("value").eq("key", "public.legal").maybeSingle()).data?.value ?? null;
  await svc().from("site_settings").upsert({ key: "public.legal", value: LEGAL });
  userId = await makeCustomer(email);
  productId = (await makeOwnProduct({ name: "Cabo Privacidade E2E", priceMinor: 9990 })).id;
});
test.afterAll(async () => {
  await svc().from("orders").delete().eq("user_id", userId);
  await svc().auth.admin.deleteUser(userId);
  await deleteProduct(productId);
  await svc().from("site_settings").update({ value: previousLegal ?? { company_name: "", tax_id: "", address: "" } }).eq("key", "public.legal");
  await setBusinessModels({ ownStore: true, affiliates: true });
});
test.beforeEach(async ({ page }) => acceptCookies(page));

test("checkout shows the privacy notice, refuses a minor and keeps the date of an adult on the profile only", async ({ page }) => {
  await customerLogin(page, email);
  await page.evaluate((id) => localStorage.setItem("nx_cart_v1", JSON.stringify([{ productId: id, quantity: 1 }])), productId);
  await page.goto("/pt-br/checkout");

  const notice = page.getByTestId("checkout-privacy");
  await expect(notice).toContainText("A NexForge respeita sua privacidade e a confidencialidade dos seus dados.");
  await expect(notice.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", /privacidade/);

  await page.getByLabel("Nome completo").fill("Ana Souza");
  await page.getByLabel("CPF", { exact: true }).fill("529.982.247-25");
  await page.getByLabel("Telefone com DDD").fill("(11) 98765-4321");
  await page.getByLabel("CEP").fill("01310-100");
  await page.getByLabel("Rua").fill("Av. Paulista");
  await page.getByLabel("Número", { exact: true }).fill("1000");
  await page.getByLabel("Bairro").fill("Bela Vista");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").fill("SP");
  await expect(page.getByRole("checkbox", { name: /Salvar este endereço/ })).not.toBeChecked();

  const submit = page.getByRole("button", { name: "Continuar para o pagamento" });
  await submit.click();
  await expect(page.getByText("Informe uma data de nascimento válida.")).toBeVisible();

  await page.getByLabel("Data de nascimento").fill(`${new Date().getFullYear() - 10}-01-01`);
  await submit.click();
  await expect(page.getByText("As compras são permitidas apenas para maiores de 18 anos.")).toBeVisible();
  expect(await profileBirthDate()).toBeNull();
  expect((await svc().from("orders").select("id").eq("user_id", userId)).data).toHaveLength(0);

  await page.getByLabel("Data de nascimento").fill("1990-05-20");
  await submit.click();
  // no real Stripe key here: the order is created, then refused by Stripe
  await expect.poll(profileBirthDate).toBe("1990-05-20");
  await expect.poll(async () => (await svc().from("orders").select("id").eq("user_id", userId)).data?.length).toBe(1);
  const { data: orders } = await svc().from("orders").select("customer, shipping").eq("user_id", userId);
  expect(JSON.stringify(orders)).not.toContain("1990-05-20");

  await page.goto("/pt-br/minha-conta");
  await expect(page.getByLabel("Data de nascimento")).toHaveValue("1990-05-20");
  const res = await page.request.get("/api/account/export");
  const body = await res.json();
  expect(body.profile.birth_date).toBe("1990-05-20");
  expect(body.order_customer_data[0].customer.cpf).toBe("52998224725");
});

test("the checkout prefills the saved date and the account page can clear it", async ({ page }) => {
  await svc().from("orders").delete().eq("user_id", userId);
  await customerLogin(page, email);
  await page.evaluate((id) => localStorage.setItem("nx_cart_v1", JSON.stringify([{ productId: id, quantity: 1 }])), productId);
  await page.goto("/pt-br/checkout");
  await expect(page.getByLabel("Data de nascimento")).toHaveValue("1990-05-20");
  await page.goto("/pt-br/minha-conta");
  await page.getByLabel("Data de nascimento").fill("");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect.poll(profileBirthDate).toBeNull();
});
