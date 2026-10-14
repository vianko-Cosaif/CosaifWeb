// @vitest-environment jsdom
import { Profiler, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import UserForm from "@/features/usuarios/components/UserForm";
import { LOCAL_COORDINATOR_ROLE_OPTIONS } from "@/features/usuarios/constants";
import type { Empresa, Localidad, UserFormValues } from "@/features/usuarios/types";

type FormProps = ComponentProps<typeof UserForm>;

// The internal company must come first: this ordering triggered the original loop.
const companies: Empresa[] = [
  { id: 11, nombre: "COSAIF" },
  { id: 22, nombre: "Empresa sintética A" },
  { id: 33, nombre: "Empresa sintética B" },
];
const localities: Localidad[] = [{ id: 2, nombre: "Torreón" }];
const draft = {
  nombre: "usuario-sintetico",
  email: "usuario.synthetic@example.invalid",
  password: "Synthetic-only-123!",
};

beforeEach(() => {
  // These component tests must never create a real account or contact an API.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("Unexpected network request"))),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderGuarded(overrides: Partial<FormProps> = {}) {
  let commits = 0;
  let props: FormProps = {
    mode: "create",
    empresas: companies,
    localidades: localities,
    roleOptions: LOCAL_COORDINATOR_ROLE_OPTIONS,
    lockLocalidad: true,
    onSubmit: vi.fn(async (_values: UserFormValues) => {}),
    onCancel: vi.fn(),
    ...overrides,
  };
  const form = () => (
    <Profiler
      id="user-form-stability"
      onRender={() => {
        // React's passive-effect loop can keep a test alive indefinitely. Throw
        // before its warning threshold so the original bug fails promptly.
        commits += 1;
        if (commits > 32) throw new Error("UserForm did not settle within 32 commits");
      }}
    >
      <UserForm {...props} />
    </Profiler>
  );
  const result = render(form());
  return {
    ...result,
    rerenderForm(next: Partial<FormProps>) {
      props = { ...props, ...next };
      result.rerender(form());
    },
  };
}

function fillDraft() {
  fireEvent.change(screen.getByPlaceholderText("Usuario / nombre de acceso"), {
    target: { value: draft.nombre },
  });
  fireEvent.change(screen.getByPlaceholderText("correo@empresa.com"), {
    target: { value: draft.email },
  });
  fireEvent.change(screen.getByPlaceholderText("Contraseña (minimo 8)"), {
    target: { value: draft.password },
  });
  fireEvent.change(screen.getByPlaceholderText("Confirmar contraseña"), {
    target: { value: draft.password },
  });
}

function expectDraftPreserved() {
  expect(screen.getByPlaceholderText("Usuario / nombre de acceso")).toHaveProperty(
    "value",
    draft.nombre,
  );
  expect(screen.getByPlaceholderText("correo@empresa.com")).toHaveProperty("value", draft.email);
  expect(screen.getByPlaceholderText("Contraseña (minimo 8)")).toHaveProperty(
    "value",
    draft.password,
  );
  expect(screen.getByPlaceholderText("Confirmar contraseña")).toHaveProperty(
    "value",
    draft.password,
  );
}

it("settles with an internal company first and keeps all four coordinator roles reachable", () => {
  renderGuarded();
  const allowed = ["Cliente", "Arrastre Torreon", "Maquinista", "Maquinista arrastre"];
  for (const name of allowed) {
    expect(screen.getByRole("button", { name })).toBeTruthy();
  }
  for (const name of ["Administrador", "Comercial", "Coordinador", "Supervisor"]) {
    expect(screen.queryByRole("button", { name })).toBeNull();
  }

  for (const [name, companyId] of [
    ["Cliente", "22"],
    ["Maquinista", "11"],
    ["Arrastre Torreon", "22"],
    ["Maquinista arrastre", "11"],
  ]) {
    fireEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveProperty("value", companyId);
    expect(
      screen.queryByText("La empresa seleccionada no es compatible con el rol elegido."),
    ).toBeNull();
    for (const roleName of allowed) {
      expect(screen.getByRole("button", { name: roleName })).toBeTruthy();
    }
  }
  expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("value", "2");
  expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("disabled", true);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  { label: "Cliente", rol: "CLIENTE", empresaId: 22 },
  { label: "Maquinista", rol: "MAQUINISTA", empresaId: 11 },
])(
  "submits one valid $rol account with the coordinator's locked locality",
  async ({ label, rol, empresaId }) => {
    const onSubmit = vi.fn(async (_values: UserFormValues) => {});
    renderGuarded({ onSubmit });
    fireEvent.click(screen.getByRole("button", { name: label }));
    fillDraft();
    const submit = screen.getByRole("button", { name: "Crear Usuario" });
    expect(submit).toHaveProperty("disabled", false);
    fireEvent.click(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ ...draft, rol, empresaId, localidadId: 2 });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Crear Usuario" })).toHaveProperty(
        "disabled",
        false,
      ),
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("preserves draft fields and the selected company when catalogs receive new references or ordering", () => {
  const form = renderGuarded();
  fireEvent.click(screen.getByRole("button", { name: "Cliente" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Empresa" }), { target: { value: "33" } });
  fillDraft();
  form.rerenderForm({
    empresas: [...companies].reverse().map((company) => ({ ...company })),
    localidades: localities.map((locality) => ({ ...locality })),
    roleOptions: [...LOCAL_COORDINATOR_ROLE_OPTIONS],
  });
  expectDraftPreserved();
  expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveProperty("value", "33");
  expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("value", "2");
  expect(fetch).not.toHaveBeenCalled();
});

it("fills the missing locked locality when catalogs arrive without discarding the draft", async () => {
  const onSubmit = vi.fn(async (_values: UserFormValues) => {});
  const form = renderGuarded({ empresas: [], localidades: [], onSubmit });
  fillDraft();
  expect(screen.getByRole("button", { name: "Crear Usuario" })).toHaveProperty("disabled", true);
  form.rerenderForm({ empresas: companies, localidades: localities });
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("value", "2"),
  );
  expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("disabled", true);
  expectDraftPreserved();
  fireEvent.click(screen.getByRole("button", { name: "Maquinista" }));
  expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveProperty("value", "11");
  fireEvent.click(screen.getByRole("button", { name: "Crear Usuario" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith({
    ...draft,
    rol: "MAQUINISTA",
    empresaId: 11,
    localidadId: 2,
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Crear Usuario" })).toHaveProperty("disabled", false),
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps an allowed role selected but blocks saving when no compatible company exists", () => {
  const onSubmit = vi.fn(async (_values: UserFormValues) => {});
  const form = renderGuarded({ empresas: [companies[1]], onSubmit });
  fireEvent.click(screen.getByRole("button", { name: "Maquinista" }));
  fillDraft();
  expect(screen.getByRole("button", { name: "Maquinista" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.getByRole("combobox", { name: /^Empresa/ })).toHaveProperty("value", "");
  const submit = screen.getByRole("button", { name: "Crear Usuario" });
  expect(submit).toHaveProperty("disabled", true);
  fireEvent.click(submit);
  expect(onSubmit).not.toHaveBeenCalled();

  form.rerenderForm({ empresas: companies });
  expect(screen.getByRole("button", { name: "Maquinista" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveProperty("value", "11");
  expectDraftPreserved();
  expect(screen.getByRole("button", { name: "Crear Usuario" })).toHaveProperty("disabled", false);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it("edits a valid maquinista without changing its company, locality or optional password", async () => {
  const editCompanies = [...companies, { id: 44, nombre: "VIANKO" }];
  const onSubmit = vi.fn(async (_values: UserFormValues) => {});
  const initial = {
    id: 501,
    nombre: "maquinista-sintetico",
    email: "maquinista.synthetic@example.invalid",
    rol: "MAQUINISTA" as const,
    empresaId: 44,
    localidadId: 2,
  };
  const form = renderGuarded({ mode: "edit", empresas: editCompanies, initial, onSubmit });
  expect(screen.getByRole("button", { name: "Maquinista" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveProperty("value", "44");
  expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("value", "2");
  expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("disabled", true);
  expect(screen.getByPlaceholderText("Nueva contraseña (opcional)")).toHaveProperty("value", "");
  fireEvent.change(screen.getByPlaceholderText("Usuario / nombre de acceso"), {
    target: { value: "maquinista-actualizado" },
  });
  form.rerenderForm({
    empresas: editCompanies.map((company) => ({ ...company })),
    localidades: localities.map((locality) => ({ ...locality })),
    roleOptions: [...LOCAL_COORDINATOR_ROLE_OPTIONS],
  });
  expect(screen.getByPlaceholderText("Usuario / nombre de acceso")).toHaveProperty(
    "value",
    "maquinista-actualizado",
  );
  expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveProperty("value", "44");
  const submit = screen.getByRole("button", { name: "Guardar Cambios" });
  expect(submit).toHaveProperty("disabled", false);
  fireEvent.click(submit);
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit).toHaveBeenCalledWith({
    nombre: "maquinista-actualizado",
    email: initial.email,
    rol: "MAQUINISTA",
    empresaId: 44,
    localidadId: 2,
    password: "",
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Guardar Cambios" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("preserves an existing account's company while its catalog is temporarily unavailable", () => {
  const editCompanies = [...companies, { id: 44, nombre: "VIANKO" }];
  const onSubmit = vi.fn(async (_values: UserFormValues) => {});
  const form = renderGuarded({
    mode: "edit",
    empresas: editCompanies,
    initial: {
      id: 502,
      nombre: "maquinista-catalogo",
      email: "catalog.synthetic@example.invalid",
      rol: "MAQUINISTA",
      empresaId: 44,
      localidadId: 2,
    },
    onSubmit,
  });
  fireEvent.change(screen.getByPlaceholderText("Usuario / nombre de acceso"), {
    target: { value: "borrador-preservado" },
  });
  form.rerenderForm({ empresas: [] });
  expect(screen.getByRole("button", { name: "Guardar Cambios" })).toHaveProperty("disabled", true);
  expect(onSubmit).not.toHaveBeenCalled();

  // COSAIF remains first when the catalog returns: choosing it automatically
  // would silently move this existing account away from its valid VIANKO company.
  form.rerenderForm({ empresas: editCompanies.map((company) => ({ ...company })) });
  expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveProperty("value", "44");
  expect(screen.getByRole("button", { name: "Maquinista" }).getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(screen.getByRole("combobox", { name: "Localidad" })).toHaveProperty("value", "2");
  expect(screen.getByPlaceholderText("Usuario / nombre de acceso")).toHaveProperty(
    "value",
    "borrador-preservado",
  );
  expect(screen.getByRole("button", { name: "Guardar Cambios" })).toHaveProperty("disabled", false);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
