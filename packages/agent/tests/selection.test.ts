import { it, expect } from "vitest";
import { createProductSelection } from "../src/index.js";
const p = {
  id: 1,
  title: "Phone",
  description: "A phone",
  price: 100,
  thumbnail: "https://example.com/phone.png",
  category: "smartphones",
};
it("retrieval is separate from presentation and only retrieved IDs can be selected", () => {
  const selection = createProductSelection();
  selection.add([p]);
  expect(() => selection.select([999])).toThrow("retrieved");
  expect(selection.select([1, 1])).toEqual([p]);
  expect(() => selection.select([1])).toThrow("already");
});
it("limits rendered shortlist to six and rejects empty selections", () => {
  const selection = createProductSelection();
  selection.add(Array.from({ length: 7 }, (_, i) => ({ ...p, id: i })));
  expect(() => selection.select([])).toThrow();
  expect(() => selection.select([0, 1, 2, 3, 4, 5, 6])).toThrow();
});
