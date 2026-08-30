// Human-readable labels for editor tool calls (shown in the AI chat + the
// WebMCP activity panel).

const TOOL_LABELS = {
  get_canvas_state: "Reading canvas",
  list_elements: "Listing elements",
  get_element: "Inspecting element",
  get_selected_elements: "Inspecting selection",
  take_screenshot: "Taking screenshot",
  get_canvas_screenshot: "Capturing canvas screenshot",
  get_element_screenshot: "Capturing element screenshot",
  get_region_screenshot: "Capturing region screenshot",
  find_text_elements: "Finding text",
  list_collection_items: "Opening collection",
  get_collection_item: "Inspecting collection item",
  insert_collection_item: "Inserting collection item",
  review_canvas_region: "Reviewing design",
  select_element: "Selecting element",
  select_elements: "Selecting elements",
  update_element: "Updating element",
  update_elements: "Updating elements",
  delete_element: "Deleting element",
  delete_elements: "Deleting elements",
  add_element: "Adding element",
  add_elements: "Adding elements",
  add_icon: "Adding icon",
  duplicate_element: "Duplicating element",
  duplicate_elements: "Duplicating elements",
  move_element: "Moving element",
  resize_element: "Resizing element",
  set_fill: "Changing fill",
  set_stroke: "Changing stroke",
  set_opacity: "Setting opacity",
  set_text: "Editing text",
  lock_element: "Locking element",
  unlock_element: "Unlocking element",
  hide_element: "Hiding element",
  show_element: "Showing element",
  bring_forward: "Bringing forward",
  send_backward: "Sending backward",
  bring_to_front: "Bringing to front",
  send_to_back: "Sending to back",
  agent_thought: "Thinking",
};

export function getToolLabel(tool) {
  const normalized = String(tool || "").replace(/^editor\./, "");
  return TOOL_LABELS[normalized] || normalized.replace(/_/g, " ") || "Tool";
}
