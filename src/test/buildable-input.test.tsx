import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildableScreen } from "@/routes/index";

afterEach(cleanup);

describe("Sentence submission", () => {
  it("submits on Enter", () => {
    render(<BuildableScreen />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    const submit = vi.fn();
    input.form?.addEventListener("submit", submit);
    fireEvent.change(input, { target: { value: "A map of San Francisco" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("A map of San Francisco");
  });

  it("allows Shift+Enter without submitting or preventing a newline", () => {
    render(<BuildableScreen />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    const submit = vi.fn();
    input.form?.addEventListener("submit", submit);
    const event = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true });
    fireEvent(input, event);
    expect(event.defaultPrevented).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });
});