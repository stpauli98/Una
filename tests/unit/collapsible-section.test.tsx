import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("renderuje title i description uvijek (i kad je collapsed)", () => {
    render(
      <CollapsibleSection
        title="Pravila rezervisanja"
        description="Podesite koliko unaprijed..."
      >
        <div>Editor content</div>
      </CollapsibleSection>,
    );
    expect(
      screen.getByRole("heading", { name: "Pravila rezervisanja" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Podesite koliko/)).toBeInTheDocument();
  });

  it("renderuje children u DOM-u (native details drži open state)", () => {
    render(
      <CollapsibleSection title="X" description="Y">
        <div data-testid="editor-body">Editor</div>
      </CollapsibleSection>,
    );
    // Native <details> uvijek drži children u DOM-u; CSS kontroliše vidljivost.
    expect(screen.getByTestId("editor-body")).toBeInTheDocument();
  });

  it("renderuje meta slot ako je prosljeđen", () => {
    render(
      <CollapsibleSection
        title="X"
        description="Y"
        meta={<p data-testid="meta">Zadnje: 22.05.2026.</p>}
      >
        <div>Editor</div>
      </CollapsibleSection>,
    );
    expect(screen.getByTestId("meta")).toBeInTheDocument();
  });

  it("default je collapsed (details bez open atributa)", () => {
    const { container } = render(
      <CollapsibleSection title="X" description="Y">
        <div>Editor</div>
      </CollapsibleSection>,
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.hasAttribute("open")).toBe(false);
  });

  it("defaultOpen=true postavlja open atribut", () => {
    const { container } = render(
      <CollapsibleSection title="X" description="Y" defaultOpen>
        <div>Editor</div>
      </CollapsibleSection>,
    );
    const details = container.querySelector("details");
    expect(details!.hasAttribute("open")).toBe(true);
  });
});
