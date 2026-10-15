// jevhelper — the macOS side of Jev.
//
// Speaks JSON lines over stdin/stdout:
//   request:  {"rid": 1, "cmd": "snapshot", ...args}
//   response: {"rid": 1, "ok": true, "result": ...}  or  {"rid": 1, "ok": false, "error": "..."}
// ("rid", not "id": element commands carry an element "id" argument.)
//   events:   {"event": "partial" | "utterance" | "listen_error", ...}
//
// It reads the frontmost app's UI through the Accessibility API, performs actions
// (press, type, keys, scroll, open apps) and streams on-device speech recognition.

import AppKit
import ApplicationServices
import AVFoundation
import Carbon
import Speech

setvbuf(stdout, nil, _IOLBF, 0)

// MARK: - IO

let outputQueue = DispatchQueue(label: "jev.output")

func send(_ object: [String: Any]) {
  outputQueue.async {
    guard let data = try? JSONSerialization.data(withJSONObject: object, options: []),
          var line = String(data: data, encoding: .utf8) else { return }
    line += "\n"
    FileHandle.standardOutput.write(line.data(using: .utf8)!)
  }
}

struct HelperError: Error { let message: String }

func fail(_ message: String) -> HelperError { HelperError(message: message) }

// MARK: - Accessibility helpers

func attr(_ el: AXUIElement, _ name: String) -> AnyObject? {
  var value: AnyObject?
  return AXUIElementCopyAttributeValue(el, name as CFString, &value) == .success ? value : nil
}

func attrs(_ el: AXUIElement, _ names: [String]) -> [AnyObject?] {
  var values: CFArray?
  let result = AXUIElementCopyMultipleAttributeValues(el, names as CFArray, AXCopyMultipleAttributeOptions(rawValue: 0), &values)
  // Some apps (Chromium/Brave) reject the batched call; fall back to one attribute at a time.
  guard result == .success, let array = values as? [AnyObject], array.count == names.count else { return names.map { attr(el, $0) } }
  return array.map { value in
    // Missing attributes come back as AXValue-wrapped errors.
    if CFGetTypeID(value) == AXValueGetTypeID(), AXValueGetType(value as! AXValue) == .axError { return nil }
    return value
  }
}

func str(_ value: AnyObject?) -> String? {
  if let s = value as? String { return s.isEmpty ? nil : s }
  if let n = value as? NSNumber { return n.stringValue }
  if let a = value as? NSAttributedString { return a.string.isEmpty ? nil : a.string }
  return nil
}

func point(_ value: AnyObject?) -> CGPoint? {
  guard let v = value, CFGetTypeID(v) == AXValueGetTypeID() else { return nil }
  var p = CGPoint.zero
  return AXValueGetValue(v as! AXValue, .cgPoint, &p) ? p : nil
}

func size(_ value: AnyObject?) -> CGSize? {
  guard let v = value, CFGetTypeID(v) == AXValueGetTypeID() else { return nil }
  var s = CGSize.zero
  return AXValueGetValue(v as! AXValue, .cgSize, &s) ? s : nil
}

func actionNames(_ el: AXUIElement) -> [String] {
  var names: CFArray?
  guard AXUIElementCopyActionNames(el, &names) == .success, let list = names as? [String] else { return [] }
  return list
}

func clean(_ s: String?, _ limit: Int = 80) -> String {
  guard let s else { return "" }
  let collapsed = s.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
  return collapsed.count > limit ? String(collapsed.prefix(limit)) + "…" : collapsed
}

// AXUIElement wrapper usable as a dictionary key, so element ids stay stable across snapshots.
struct ElementKey: Hashable {
  let el: AXUIElement
  static func == (a: ElementKey, b: ElementKey) -> Bool { CFEqual(a.el, b.el) }
  func hash(into hasher: inout Hasher) { hasher.combine(CFHash(el)) }
}

final class Registry {
  private var byId: [Int: AXUIElement] = [:]
  private var byKey: [ElementKey: Int] = [:]
  private var nextId = 1

  func id(for el: AXUIElement) -> Int {
    let key = ElementKey(el: el)
    if let id = byKey[key] { return id }
    if byId.count > 20_000 { byId.removeAll(); byKey.removeAll() }
    let id = nextId
    nextId += 1
    byId[id] = el
    byKey[key] = id
    return id
  }

  func element(_ id: Int) throws -> AXUIElement {
    guard let el = byId[id] else { throw fail("Unknown element \(id); take a new snapshot") }
    return el
  }
}

let registry = Registry()

// Roles worth offering as action targets.
let interactiveRoles: Set<String> = [
  "AXButton", "AXCheckBox", "AXRadioButton", "AXPopUpButton", "AXMenuButton", "AXComboBox",
  "AXTextField", "AXTextArea", "AXSearchField", "AXSecureTextField", "AXLink", "AXMenuItem",
  "AXMenuBarItem", "AXTab", "AXSlider", "AXIncrementor", "AXDisclosureTriangle", "AXRow",
  "AXCell", "AXDockItem", "AXColorWell", "AXSwitch", "AXToggle",
]
let textRoles: Set<String> = ["AXStaticText", "AXHeading"]
let containerSkipRoles: Set<String> = ["AXScrollBar", "AXRuler", "AXValueIndicator", "AXGrowArea"]

let snapshotAttrs = [
  "AXRole", "AXSubrole", "AXTitle", "AXDescription", "AXValue", "AXHelp", "AXPlaceholderValue",
  "AXEnabled", "AXPosition", "AXSize", "AXChildren", "AXSelected", "AXFocused", "AXRoleDescription",
]

struct Snapshot {
  var app: String
  var window: String
  var elements: [[String: Any]] = []
  var text: [String] = []
  var textLength = 0
  var truncated = false
  var visited = 0
  var pruned = 0
}

/// The app the user is working in. When the terminal running Jev is in front (you just
/// typed a command into it), that's the app whose window is right behind the terminal.
func frontmostApp() -> NSRunningApplication? {
  guard let front = NSWorkspace.shared.frontmostApplication else { return nil }
  if !hostPids.contains(front.processIdentifier) { return front }
  return appBehindHost() ?? front
}

/// The topmost normal window that doesn't belong to the terminal running Jev.
func appBehindHost() -> NSRunningApplication? {
  let windows = (CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]) ?? []
  for w in windows {
    guard (w[kCGWindowLayer as String] as? Int) == 0, let pid = w[kCGWindowOwnerPID as String] as? pid_t,
          !hostPids.contains(pid), let app = NSRunningApplication(processIdentifier: pid), app.activationPolicy == .regular else { continue }
    return app
  }
  return nil
}

func appElement(_ app: NSRunningApplication) -> AXUIElement {
  let el = AXUIElementCreateApplication(app.processIdentifier)
  // Chromium (Brave, Chrome, Electron apps) only exposes web content to assistive tech
  // once it's been asked to.
  AXUIElementSetAttributeValue(el, "AXManualAccessibility" as CFString, kCFBooleanTrue)
  return el
}

/// Text inside an element (e.g. a link or row whose label lives in child text nodes).
func descendantText(_ el: AXUIElement, depth: Int = 0, budget: inout Int) -> String {
  guard depth < 5, budget > 0 else { return "" }
  budget -= 1
  let values = attrs(el, ["AXRole", "AXValue", "AXTitle", "AXDescription", "AXChildren"])
  var parts: [String] = []
  let role = str(values[0]) ?? ""
  // A row's own name can sit in a text field (Finder's file names).
  if textRoles.contains(role) || role == "AXImage" || role == "AXTextField" {
    if let t = str(values[1]) ?? str(values[2]) ?? str(values[3]) { parts.append(t) }
  }
  for child in (values[4] as? [AXUIElement]) ?? [] {
    let t = descendantText(child, depth: depth + 1, budget: &budget)
    if !t.isEmpty { parts.append(t) }
    if parts.joined().count > 120 { break }
  }
  return parts.joined(separator: " ")
}

func screensInAXCoordinates() -> CGRect {
  let mainHeight = NSScreen.screens.first?.frame.height ?? 0
  return NSScreen.screens.reduce(CGRect.null) { area, screen in
    let f = screen.frame
    return area.union(CGRect(x: f.minX, y: mainHeight - f.maxY, width: f.width, height: f.height))
  }
}

func takeSnapshot(maxElements: Int, maxText: Int, includeMenus: Bool) throws -> Snapshot {
  guard AXIsProcessTrusted() else { throw fail("Accessibility permission missing") }
  guard let app = frontmostApp() else { throw fail("No frontmost app") }
  let appEl = appElement(app)
  AXUIElementSetMessagingTimeout(appEl, 1.0)

  let focusedWindow = attr(appEl, "AXFocusedWindow").map { $0 as! AXUIElement }
  let windows = (attr(appEl, "AXWindows") as? [AXUIElement]) ?? []
  let root = focusedWindow ?? windows.first
  var snap = Snapshot(app: app.localizedName ?? "Unknown", window: root.flatMap { str(attr($0, "AXTitle")) } ?? "")

  // Visible area = all screens, in Accessibility coordinates (origin top-left of the main
  // screen). Window frames aren't reliable: Chromium reports its tab strip and toolbar
  // outside its own window frame.
  let visibleArea = screensInAXCoordinates()

  let deadline = Date().addingTimeInterval(2.0)
  var queue: [(AXUIElement, Int)] = []
  if let root { queue.append((root, 0)) }
  // Sheets, popovers and dialogs of the app that aren't the focused window.
  for w in windows where focusedWindow == nil || !CFEqual(w, focusedWindow!) {
    if str(attr(w, "AXSubrole")) == "AXDialog" || str(attr(w, "AXRole")) == "AXSheet" { queue.append((w, 0)) }
  }

  var head = 0
  while head < queue.count {
    if snap.elements.count >= maxElements || Date() > deadline { snap.truncated = true; break }
    let (el, depth) = queue[head]
    head += 1
    let v = attrs(el, snapshotAttrs)
    snap.visited += 1
    let role = str(v[0]) ?? ""
    if containerSkipRoles.contains(role) { continue }
    let enabled = (v[7] as? Bool) ?? true

    var frame: CGRect?
    if let p = point(v[8]), let s = size(v[9]) { frame = CGRect(origin: p, size: s) }
    // Prune branches that are really off screen. Zero-size wrappers (Chromium wraps its
    // whole UI in them) are still walked; they just can't be targets themselves.
    let hasArea = frame.map { $0.width >= 1 && $0.height >= 1 } ?? true
    if let f = frame, depth > 0, hasArea, !f.intersects(visibleArea) { snap.pruned += 1; continue }

    if textRoles.contains(role), hasArea, snap.textLength < maxText, let t = str(v[4]) ?? str(v[2]) {
      let c = clean(t, 400)
      if !c.isEmpty { snap.text.append(c); snap.textLength += c.count }
    }

    var isTarget = hasArea && interactiveRoles.contains(role)
    if !isTarget, hasArea, enabled, role == "AXGroup" || role == "AXImage" || role == "AXStaticText" {
      // Custom controls: groups/images that respond to a press.
      isTarget = actionNames(el).contains("AXPress") && depth > 1
    }
    if isTarget {
      var label = [str(v[2]), str(v[3]), str(v[5])].compactMap { $0 }.first ?? ""
      if label.isEmpty || role == "AXRow" || role == "AXCell" || role == "AXLink" {
        var budget = 40
        let inner = descendantText(el, budget: &budget)
        if !inner.isEmpty && !label.contains(inner) { label = label.isEmpty ? inner : "\(label) — \(inner)" }
      }
      var item: [String: Any] = [
        "id": registry.id(for: el),
        "role": (str(v[1]).map { $0 == "AXSearchField" ? $0 : nil } ?? nil) ?? role,
        "label": clean(label),
      ]
      if let placeholder = str(v[6]) { item["placeholder"] = clean(placeholder, 40) }
      if role.contains("Text") || role == "AXComboBox" || role == "AXSearchField" || role == "AXCheckBox" || role == "AXSlider" || role == "AXPopUpButton" || role == "AXRadioButton" {
        if let value = str(v[4]), role != "AXSecureTextField" { item["value"] = clean(value, 60) }
      }
      if !enabled { item["disabled"] = true }
      if (v[11] as? Bool) == true { item["selected"] = true }
      if (v[12] as? Bool) == true { item["focused"] = true }
      if let f = frame { item["frame"] = [Int(f.minX), Int(f.minY), Int(f.width), Int(f.height)] }
      snap.elements.append(item)
    }

    // Don't descend into closed menus or into text areas' runs.
    if role == "AXMenuBar" || role == "AXTextArea" { continue }
    for child in (v[10] as? [AXUIElement]) ?? [] { queue.append((child, depth + 1)) }
  }

  if includeMenus, let menuBar = attr(appEl, "AXMenuBar") {
    for item in (attr(menuBar as! AXUIElement, "AXChildren") as? [AXUIElement]) ?? [] {
      guard let title = str(attr(item, "AXTitle")), title != "Apple" else { continue }
      snap.elements.append(["id": registry.id(for: item), "role": "AXMenuBarItem", "label": title])
    }
  }
  return snap
}

// MARK: - Input synthesis

let keyCodes: [String: CGKeyCode] = [
  "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12,
  "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23,
  "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29, "]": 30, "o": 31, "u": 32, "[": 33, "i": 34,
  "p": 35, "l": 37, "j": 38, "'": 39, "k": 40, ";": 41, "\\": 42, ",": 43, "/": 44, "n": 45, "m": 46,
  ".": 47, "`": 50, "return": 36, "enter": 36, "tab": 48, "space": 49, "delete": 51, "backspace": 51,
  "escape": 53, "esc": 53, "forwarddelete": 117, "home": 115, "end": 119, "pageup": 116, "pagedown": 121,
  "left": 123, "right": 124, "down": 125, "up": 126, "f1": 122, "f2": 120, "f3": 99, "f4": 118,
  "f5": 96, "f6": 97, "f7": 98, "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111,
]

/// Maps characters to key codes for the user's current keyboard layout (AZERTY, QWERTZ…).
/// Key codes are physical positions: on AZERTY the QWERTY "a" position types "q", so
/// a hard-coded US table would turn ⌘A into ⌘Q.
func layoutKeyCodes() -> [String: CGKeyCode] {
  var map: [String: CGKeyCode] = [:]
  guard let source = TISCopyCurrentKeyboardLayoutInputSource()?.takeRetainedValue(),
        let raw = TISGetInputSourceProperty(source, kTISPropertyUnicodeKeyLayoutData) else { return map }
  let data = Unmanaged<CFData>.fromOpaque(raw).takeUnretainedValue() as Data
  data.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
    guard let layout = bytes.bindMemory(to: UCKeyboardLayout.self).baseAddress else { return }
    for code in 0..<128 {
      var deadKeys: UInt32 = 0
      var chars = [UniChar](repeating: 0, count: 4)
      var length = 0
      let status = UCKeyTranslate(layout, UInt16(code), UInt16(kUCKeyActionDown), 0, UInt32(LMGetKbdType()),
                                  OptionBits(kUCKeyTranslateNoDeadKeysBit), &deadKeys, chars.count, &length, &chars)
      guard status == noErr, length > 0 else { continue }
      let key = String(utf16CodeUnits: chars, count: length).lowercased()
      if map[key] == nil { map[key] = CGKeyCode(code) }
    }
  }
  return map
}

let namedKeys: Set<String> = [
  "return", "enter", "tab", "space", "delete", "backspace", "escape", "esc", "forwarddelete", "home", "end",
  "pageup", "pagedown", "left", "right", "down", "up", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
]

func pressKeys(_ combo: String) throws {
  let layout = layoutKeyCodes()
  let parts = combo.lowercased().replacingOccurrences(of: " ", with: "").split(separator: "+").map(String.init)
  var flags: CGEventFlags = []
  var key: CGKeyCode?
  for part in parts {
    switch part {
    case "cmd", "command", "⌘": flags.insert(.maskCommand)
    case "shift", "⇧": flags.insert(.maskShift)
    case "alt", "option", "opt", "⌥": flags.insert(.maskAlternate)
    case "ctrl", "control", "⌃": flags.insert(.maskControl)
    case "fn": flags.insert(.maskSecondaryFn)
    default:
      // Named keys are layout independent; characters come from the current layout,
      // falling back to the US position (e.g. digits that need Shift on AZERTY).
      let code = namedKeys.contains(part) ? keyCodes[part] : (layout[part] ?? keyCodes[part])
      guard let code else { throw fail("Unknown key \"\(part)\"") }
      key = code
    }
  }
  guard let key else { throw fail("No key in \"\(combo)\"") }
  let source = CGEventSource(stateID: .hidSystemState)
  let down = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: true)!
  let up = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: false)!
  down.flags = flags
  // Releasing with no modifiers, so Command doesn't "stick" to the next keystrokes.
  up.flags = []
  down.post(tap: .cghidEventTap)
  up.post(tap: .cghidEventTap)
  waitForIdle(40)
}

/// Code and long text are pasted: editors auto-close brackets and quotes when typed,
/// and pasting is much faster. The user's clipboard is restored afterwards.
func shouldPaste(_ text: String) -> Bool {
  text.count > 40 || text.contains("\n") || text.rangeOfCharacter(from: CharacterSet(charactersIn: "()[]{}\"'`<>")) != nil
}

func pasteText(_ text: String) throws {
  let board = NSPasteboard.general
  let saved = board.string(forType: .string)
  board.clearContents()
  board.setString(text, forType: .string)
  try pressKeys("cmd+v")
  waitForIdle(200)
  board.clearContents()
  if let saved { board.setString(saved, forType: .string) }
}

func typeText(_ text: String) {
  if shouldPaste(text), (try? pasteText(text)) != nil { return }
  let source = CGEventSource(stateID: .hidSystemState)
  // Newlines are sent as Return so multi-line text works in any app.
  for (index, line) in text.components(separatedBy: "\n").enumerated() {
    if index > 0 { try? pressKeys("return") }
    let utf16 = Array(line.utf16)
    var offset = 0
    while offset < utf16.count {
      let chunk = Array(utf16[offset..<min(offset + 20, utf16.count)])
      let down = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: true)!
      let up = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: false)!
      down.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: chunk)
      up.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: chunk)
      // Plain characters: never inherit a modifier from an earlier shortcut.
      down.flags = []
      up.flags = []
      down.post(tap: .cghidEventTap)
      up.post(tap: .cghidEventTap)
      offset += chunk.count
      usleep(2_000)
    }
  }
  // Give the target app time to process the events before we report back.
  waitForIdle(40 + min(text.count, 400))
}

func center(of el: AXUIElement) throws -> CGPoint {
  let v = attrs(el, ["AXPosition", "AXSize"])
  guard let p = point(v[0]), let s = size(v[1]) else { throw fail("Element has no position on screen") }
  return CGPoint(x: p.x + s.width / 2, y: p.y + s.height / 2)
}

func mouseClick(at p: CGPoint, count: Int = 1, right: Bool = false) {
  let down: CGEventType = right ? .rightMouseDown : .leftMouseDown
  let up: CGEventType = right ? .rightMouseUp : .leftMouseUp
  let button: CGMouseButton = right ? .right : .left
  CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: p, mouseButton: button)?.post(tap: .cghidEventTap)
  usleep(20_000)
  for i in 1...count {
    let d = CGEvent(mouseEventSource: nil, mouseType: down, mouseCursorPosition: p, mouseButton: button)!
    let u = CGEvent(mouseEventSource: nil, mouseType: up, mouseCursorPosition: p, mouseButton: button)!
    d.setIntegerValueField(.mouseEventClickState, value: Int64(i))
    u.setIntegerValueField(.mouseEventClickState, value: Int64(i))
    d.post(tap: .cghidEventTap)
    u.post(tap: .cghidEventTap)
  }
}

func press(_ el: AXUIElement, mode: String) throws -> String {
  if mode == "double" || mode == "right" {
    mouseClick(at: try center(of: el), count: mode == "double" ? 2 : 1, right: mode == "right")
    return "\(mode)-clicked"
  }
  let actions = actionNames(el)
  let role = str(attr(el, "AXRole")) ?? ""
  // Things scrolled out of view (in a list or page): bring them into view first.
  if actions.contains("AXScrollToVisible") { AXUIElementPerformAction(el, "AXScrollToVisible" as CFString); waitForIdle(60) }
  // Rows and cells usually select on click rather than AXPress.
  if role != "AXRow" && role != "AXCell", actions.contains("AXPress"),
     AXUIElementPerformAction(el, "AXPress" as CFString) == .success {
    return "pressed"
  }
  if actions.contains("AXPick"), AXUIElementPerformAction(el, "AXPick" as CFString) == .success { return "picked" }
  mouseClick(at: try center(of: el))
  return "clicked"
}

func currentValue(_ el: AXUIElement) -> String { str(attr(el, "AXValue")) ?? "" }

/// Waits until input has actually landed (keyboard events are delivered asynchronously).
func waitForValue(_ el: AXUIElement, timeout: TimeInterval = 1.5, _ done: (String) -> Bool) -> Bool {
  let deadline = Date().addingTimeInterval(timeout)
  repeat {
    if done(currentValue(el)) { return true }
    waitForIdle(30)
  } while Date() < deadline
  return false
}

func setText(_ el: AXUIElement, _ text: String, append: Bool) throws -> String {
  AXUIElementSetAttributeValue(el, "AXFocused" as CFString, kCFBooleanTrue)
  waitForIdle(60)
  if str(attr(el, "AXFocused")) != "1" {
    // Some web fields only take focus from a real click.
    mouseClick(at: try center(of: el))
    waitForIdle(100)
  }
  let target = append ? currentValue(el) + text : text

  // Fast path: set the value directly, and trust it only if it reads back.
  if AXUIElementSetAttributeValue(el, "AXValue" as CFString, target as CFString) == .success,
     waitForValue(el, timeout: 0.3, { $0 == target }) {
    // Setting the value can end editing; put the keyboard focus back so Return,
    // shortcuts and further typing still go to this field.
    AXUIElementSetAttributeValue(el, "AXFocused" as CFString, kCFBooleanTrue)
    waitForIdle(40)
    try pressKeys("end")
    return "set"
  }

  // Fallback: real keystrokes (web apps, editors, custom fields).
  if !append {
    try pressKeys("cmd+a")
    waitForIdle(50)
  }
  typeText(text)
  if waitForValue(el, { $0 == target || $0.hasSuffix(text) }) { return "typed" }
  return "typed (could not confirm the field's new value)"
}

func scroll(_ direction: String, amount: Int, at el: AXUIElement?) throws {
  if let el { CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: try center(of: el), mouseButton: .left)?.post(tap: .cghidEventTap) }
  let lines = Int32(amount)
  let (dy, dx): (Int32, Int32) = switch direction {
  case "up": (lines, 0)
  case "down": (-lines, 0)
  case "left": (0, lines)
  case "right": (0, -lines)
  default: (0, 0)
  }
  CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 2, wheel1: dy, wheel2: dx, wheel3: 0)?.post(tap: .cghidEventTap)
}

// MARK: - Apps

/// Waits for a callback while keeping the main run loop turning (callbacks may need it).
func wait(for semaphore: DispatchSemaphore, seconds: Double) {
  let deadline = Date().addingTimeInterval(seconds)
  while semaphore.wait(timeout: .now()) == .timedOut && Date() < deadline {
    RunLoop.main.run(until: Date().addingTimeInterval(0.02))
  }
}

func applicationDirectories() -> [URL] {
  let fm = FileManager.default
  var dirs = ["/Applications", "/System/Applications", "/System/Applications/Utilities", "/Applications/Utilities"].map { URL(fileURLWithPath: $0) }
  dirs.append(fm.homeDirectoryForCurrentUser.appendingPathComponent("Applications"))
  return dirs
}

func installedApps() -> [String: URL] {
  var apps: [String: URL] = [:]
  for dir in applicationDirectories() {
    for name in (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [] where name.hasSuffix(".app") {
      apps[String(name.dropLast(4))] = dir.appendingPathComponent(name)
    }
  }
  // Finder lives outside the Applications folders but is opened and switched to like any app.
  apps["Finder"] = URL(fileURLWithPath: "/System/Library/CoreServices/Finder.app")
  return apps
}

/// Resolves a spoken app name ("brave", "vs code") to an installed app.
func resolveApp(_ query: String) -> (String, URL)? {
  let apps = installedApps()
  let q = query.lowercased().replacingOccurrences(of: ".app", with: "").trimmingCharacters(in: .whitespaces)
  let squash = { (s: String) in s.lowercased().filter { $0.isLetter || $0.isNumber } }
  let ranked = apps.compactMap { name, url -> (Int, String, URL)? in
    let n = name.lowercased()
    if n == q { return (0, name, url) }
    if squash(n) == squash(q) { return (1, name, url) }
    if n.hasPrefix(q) { return (2, name, url) }
    if n.split(separator: " ").contains(where: { $0 == q }) { return (3, name, url) }
    if n.contains(q) || squash(n).contains(squash(q)) { return (4, name, url) }
    return nil
  }.sorted { ($0.0, $0.1.count) < ($1.0, $1.1.count) }
  return ranked.first.map { ($0.1, $0.2) }
}

func openApp(_ query: String) throws -> String {
  guard let (name, url) = resolveApp(query) else { throw fail("No installed app matches \"\(query)\"") }
  let config = NSWorkspace.OpenConfiguration()
  config.activates = true
  let done = DispatchSemaphore(value: 0)
  var error: Error?
  NSWorkspace.shared.openApplication(at: url, configuration: config) { _, e in error = e; done.signal() }
  wait(for: done, seconds: 10)
  if let error { throw fail(error.localizedDescription) }
  return name
}

func openURL(_ urlString: String, app: String?) throws -> String {
  guard let url = URL(string: urlString) else { throw fail("Bad URL") }
  let config = NSWorkspace.OpenConfiguration()
  config.activates = true
  let done = DispatchSemaphore(value: 0)
  var error: Error?
  if let app, let (_, appURL) = resolveApp(app) {
    NSWorkspace.shared.open([url], withApplicationAt: appURL, configuration: config) { _, e in error = e; done.signal() }
  } else {
    NSWorkspace.shared.open(url, configuration: config) { _, e in error = e; done.signal() }
  }
  wait(for: done, seconds: 10)
  if let error { throw fail(error.localizedDescription) }
  return url.absoluteString
}

// MARK: - Speech recognition (on-device, free)

final class Listener {
  private let engine = AVAudioEngine()
  private var recognizer: SFSpeechRecognizer?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private var task: SFSpeechRecognitionTask?
  private var lastText = ""
  private var silenceTimer: Timer?
  private var generation = 0
  var silence: TimeInterval = 0.9
  /// Words to expect (app and site names, on-screen labels): recognized more reliably.
  var hints: [String] = []
  private(set) var running = false

  func start(locale: String) throws {
    if running { return }
    recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale))
    guard let recognizer, recognizer.isAvailable else { throw fail("Speech recognition unavailable for \(locale)") }
    let input = engine.inputNode
    let format = input.outputFormat(forBus: 0)
    input.removeTap(onBus: 0)
    input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
      self?.request?.append(buffer)
    }
    engine.prepare()
    try engine.start()
    running = true
    startTask()
  }

  func stop() {
    running = false
    silenceTimer?.invalidate()
    task?.cancel()
    request?.endAudio()
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
  }

  /// Drops whatever was heard so far (e.g. our own voice while speaking) and starts over.
  func reset() {
    guard running else { return }
    generation += 1
    silenceTimer?.invalidate()
    task?.cancel()
    request?.endAudio()
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { self.startTask() }
  }

  // A recognition task covers one utterance; a new one starts as soon as it ends.
  private func startTask() {
    guard running, let recognizer else { return }
    generation += 1
    let gen = generation
    lastText = ""
    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
    request.addsPunctuation = true
    request.contextualStrings = hints
    self.request = request
    task = recognizer.recognitionTask(with: request) { [weak self] result, error in
      DispatchQueue.main.async {
        guard let self, gen == self.generation else { return }
        if let result {
          let text = result.bestTranscription.formattedString
          if text != self.lastText {
            self.lastText = text
            send(["event": "partial", "text": text])
            self.armSilenceTimer(gen)
          }
          if result.isFinal { self.finish(gen) }
        } else if let error {
          let code = (error as NSError).code
          // 1110 = no speech detected; just start listening again.
          if code != 1110 && code != 216 && code != 301 { send(["event": "listen_error", "error": error.localizedDescription]) }
          self.finish(gen)
        }
      }
    }
  }

  private func armSilenceTimer(_ gen: Int) {
    silenceTimer?.invalidate()
    silenceTimer = Timer.scheduledTimer(withTimeInterval: silence, repeats: false) { [weak self] _ in
      self?.finish(gen)
    }
  }

  // End of utterance: report it and start a fresh task.
  private func finish(_ gen: Int) {
    guard gen == generation else { return }
    silenceTimer?.invalidate()
    let text = lastText.trimmingCharacters(in: .whitespacesAndNewlines)
    if !text.isEmpty { send(["event": "utterance", "text": text]) }
    generation += 1
    task?.cancel()
    request?.endAudio()
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { self.startTask() }
  }
}

let listener = Listener()

func requestSpeechPermission() -> String {
  let done = DispatchSemaphore(value: 0)
  var status = SFSpeechRecognizer.authorizationStatus()
  if status == .notDetermined {
    SFSpeechRecognizer.requestAuthorization { s in status = s; done.signal() }
    wait(for: done, seconds: 120)
  }
  return ["notDetermined", "denied", "restricted", "authorized"][Int(status.rawValue)]
}

// MARK: - Commands

func waitForIdle(_ ms: Int) { RunLoop.main.run(until: Date().addingTimeInterval(Double(ms) / 1000)) }

func handle(_ cmd: String, _ args: [String: Any]) throws -> Any {
  switch cmd {
  case "ping":
    return "pong"

  case "permissions":
    let prompt = (args["prompt"] as? Bool) ?? false
    let trusted = AXIsProcessTrustedWithOptions(["AXTrustedCheckOptionPrompt": prompt] as CFDictionary)
    if prompt && AVCaptureDevice.authorizationStatus(for: .audio) == .notDetermined {
      let done = DispatchSemaphore(value: 0)
      AVCaptureDevice.requestAccess(for: .audio) { _ in done.signal() }
      wait(for: done, seconds: 120)
    }
    return [
      "accessibility": trusted,
      "speech": prompt ? requestSpeechPermission() : ["notDetermined", "denied", "restricted", "authorized"][Int(SFSpeechRecognizer.authorizationStatus().rawValue)],
      "microphone": ["notDetermined", "restricted", "denied", "authorized"][AVCaptureDevice.authorizationStatus(for: .audio).rawValue],
    ]

  case "snapshot":
    let start = Date()
    let snap = try takeSnapshot(
      maxElements: (args["maxElements"] as? Int) ?? 200,
      maxText: (args["maxText"] as? Int) ?? 2000,
      includeMenus: (args["menus"] as? Bool) ?? true)
    return [
      "app": snap.app, "window": snap.window, "elements": snap.elements,
      "text": snap.text.joined(separator: "\n"), "truncated": snap.truncated,
      "visited": snap.visited, "pruned": snap.pruned,
      "ms": Int(Date().timeIntervalSince(start) * 1000),
    ]

  case "read_text":
    let snap = try takeSnapshot(maxElements: 5000, maxText: (args["maxText"] as? Int) ?? 15000, includeMenus: false)
    var text = snap.text.joined(separator: "\n")
    // Documents (TextEdit, Notes, editors) keep their content in a text area value.
    if let app = frontmostApp(), let focused = attr(appElement(app), "AXFocusedUIElement"),
       let value = str(attr(focused as! AXUIElement, "AXValue")), value.count > 20 {
      text += "\n" + String(value.prefix(15000))
    }
    return ["app": snap.app, "window": snap.window, "text": text]

  case "press":
    let el = try registry.element(args["id"] as? Int ?? -1)
    activateOwner(of: el)
    try guardOwnerInFront(el)
    return try press(el, mode: (args["mode"] as? String) ?? "default")

  case "set_text":
    let el = try registry.element(args["id"] as? Int ?? -1)
    activateOwner(of: el)
    try guardOwnerInFront(el)
    return try setText(el, args["text"] as? String ?? "", append: (args["append"] as? Bool) ?? false)

  case "options":
    // Items of a pop-up button's menu: open it, read the titles, close it again.
    let popup = try registry.element(args["id"] as? Int ?? -1)
    activateOwner(of: popup)
    AXUIElementPerformAction(popup, "AXPress" as CFString)
    waitForIdle(250)
    var titles: [String] = []
    for menu in (attr(popup, "AXChildren") as? [AXUIElement]) ?? [] {
      for item in (attr(menu, "AXChildren") as? [AXUIElement]) ?? [] {
        if let t = str(attr(item, "AXTitle")) { titles.append(t) }
      }
    }
    try pressKeys("escape")
    return titles

  case "select":
    // Pop-up buttons: open the menu, then press the matching item.
    let el = try registry.element(args["id"] as? Int ?? -1)
    let option = (args["option"] as? String ?? "").lowercased()
    AXUIElementPerformAction(el, "AXPress" as CFString)
    waitForIdle(250)
    for menu in (attr(el, "AXChildren") as? [AXUIElement]) ?? [] {
      for item in (attr(menu, "AXChildren") as? [AXUIElement]) ?? [] {
        if let title = str(attr(item, "AXTitle")), title.lowercased().contains(option) {
          AXUIElementPerformAction(item, "AXPress" as CFString)
          return "selected \(title)"
        }
      }
    }
    try pressKeys("escape")
    throw fail("No option matching \"\(option)\"")

  case "type":
    try guardInput(expected: args["app"] as? String)
    typeText(args["text"] as? String ?? "")
    return "typed"

  case "keys":
    try guardInput(expected: args["app"] as? String)
    try pressKeys(args["keys"] as? String ?? "")
    return "pressed"

  case "scroll":
    try guardInput(expected: args["app"] as? String)
    let el = try (args["id"] as? Int).map { try registry.element($0) }
    try scroll(args["direction"] as? String ?? "down", amount: (args["amount"] as? Int) ?? 8, at: el)
    return "scrolled"

  case "open_app":
    return try openApp(args["name"] as? String ?? "")

  case "open_url":
    return try openURL(args["url"] as? String ?? "", app: args["app"] as? String)

  case "frontmost":
    let app = frontmostApp()
    return ["app": app?.localizedName ?? "", "bundleId": app?.bundleIdentifier ?? ""]

  case "activate_app":
    let name = (args["name"] as? String ?? "").lowercased()
    guard let app = NSWorkspace.shared.runningApplications.first(where: { ($0.localizedName ?? "").lowercased().contains(name) && $0.activationPolicy == .regular })
    else { throw fail("\(name) isn't running") }
    app.activate()
    return app.localizedName ?? name

  case "running_apps":
    return NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }.compactMap { $0.localizedName }

  case "installed_apps":
    return installedApps().keys.sorted()

  case "listen":
    if (args["on"] as? Bool) ?? true {
      if let silence = args["silence"] as? Double { listener.silence = silence }
      if let hints = args["hints"] as? [String] { listener.hints = hints }
      try listener.start(locale: (args["locale"] as? String) ?? "en-US")
      return "listening"
    }
    listener.stop()
    return "stopped"

  case "web_js":
    // Runs JavaScript in the front tab of a browser through AppleScript.
    return try runBrowserJS(app: args["app"] as? String ?? "", js: args["js"] as? String ?? "")

  case "applescript":
    var error: NSDictionary?
    guard let script = NSAppleScript(source: args["source"] as? String ?? "") else { throw fail("Bad AppleScript") }
    let result = script.executeAndReturnError(&error)
    if let error { throw fail(error[NSAppleScript.errorMessage] as? String ?? "AppleScript error") }
    return result.stringValue ?? ""

  case "windows":
    return listWindows()

  case "focus_window":
    return try focusWindow(args)

  case "click_at":
    // Native click at screen coordinates (for things page scripts can't trigger, like file pickers).
    try guardInput(expected: args["app"] as? String)
    let x = args["x"] as? Double ?? 0, y = args["y"] as? Double ?? 0
    mouseClick(at: CGPoint(x: x, y: y), count: (args["count"] as? Int) ?? 1, right: (args["right"] as? Bool) ?? false)
    return "clicked"

  case "listen_hints":
    // Applies from the next utterance on.
    listener.hints = args["hints"] as? [String] ?? []
    return "ok"

  case "listen_reset":
    listener.reset()
    return "reset"

  default:
    throw fail("Unknown command \(cmd)")
  }
}

func activateOwner(of el: AXUIElement) {
  var pid: pid_t = 0
  guard AXUIElementGetPid(el, &pid) == .success, let app = NSRunningApplication(processIdentifier: pid), !app.isActive else { return }
  app.activate()
  waitForIdle(150)
}

// MARK: - Browsers

/// Executes JavaScript in the active tab of a supported browser and returns the result as text.
func runBrowserJS(app: String, js: String) throws -> String {
  let escaped = js.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
  let source: String
  if app == "Safari" {
    source = "tell application \"Safari\" to do JavaScript \"\(escaped)\" in current tab of front window"
  } else {
    source = "tell application \"\(app)\" to execute active tab of front window javascript \"\(escaped)\""
  }
  var error: NSDictionary?
  guard let script = NSAppleScript(source: source) else { throw fail("Could not build AppleScript") }
  let result = script.executeAndReturnError(&error)
  if let error {
    let message = error[NSAppleScript.errorMessage] as? String ?? "AppleScript error"
    throw fail(message)
  }
  return result.stringValue ?? ""
}

// MARK: - Windows and tabs

let chromiumBrowsers: Set<String> = ["Brave Browser", "Google Chrome", "Microsoft Edge", "Arc", "Chromium", "Vivaldi"]

func runScript(_ source: String) -> String? {
  var error: NSDictionary?
  let result = NSAppleScript(source: source)?.executeAndReturnError(&error)
  // nil only on error: a script that succeeds without a value (e.g. "activate") returns "".
  return error == nil ? (result?.stringValue ?? "") : nil
}

/// Every window of every app, and every tab of running browsers, on all screens.
func listWindows() -> [[String: Any]] {
  var out: [[String: Any]] = []
  for app in NSWorkspace.shared.runningApplications where app.activationPolicy == .regular && !hostPids.contains(app.processIdentifier) {
    let name = app.localizedName ?? ""
    if chromiumBrowsers.contains(name) || name == "Safari" {
      let titleExpr = name == "Safari" ? "name of t" : "title of t"
      let script = [
        "set out to \"\"",
        // Inside "tell <browser>", `tab` means a browser tab, so take the separators first.
        "set sep to tab",
        "set nl to linefeed",
        "tell application \"\(name)\"",
        "  set wi to 0",
        "  repeat with w in windows",
        "    set wi to wi + 1",
        "    set ti to 0",
        "    repeat with t in tabs of w",
        "      set ti to ti + 1",
        "      set out to out & wi & sep & ti & sep & (\(titleExpr)) & sep & (URL of t) & nl",
        "    end repeat",
        "  end repeat",
        "end tell",
        "return out",
      ].joined(separator: "\n")
      for line in (runScript(script) ?? "").split(separator: "\n") {
        let f = line.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
        guard f.count >= 4, let w = Int(f[0]), let t = Int(f[1]) else { continue }
        out.append(["app": name, "kind": "tab", "window": w, "tab": t, "title": f[2], "url": f[3]])
      }
      continue
    }
    let ax = appElement(app)
    for (i, w) in ((attr(ax, "AXWindows") as? [AXUIElement]) ?? []).enumerated() {
      let title = str(attr(w, "AXTitle")) ?? ""
      if title.isEmpty && str(attr(w, "AXSubrole")) != "AXStandardWindow" { continue }
      out.append(["app": name, "kind": "window", "window": i, "title": title, "minimized": (attr(w, "AXMinimized") as? Bool) ?? false])
    }
  }
  return out
}

/// Brings a window (or a browser tab) to the front, on whichever screen it is.
func focusWindow(_ args: [String: Any]) throws -> String {
  let name = args["app"] as? String ?? ""
  guard let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == name }) else { throw fail("\(name) isn't running") }
  if args["kind"] as? String == "tab", let w = args["window"] as? Int, let t = args["tab"] as? Int {
    let source = name == "Safari"
      ? "tell application \"Safari\"\nset current tab of window \(w) to tab \(t) of window \(w)\nset index of window \(w) to 1\nactivate\nend tell"
      : "tell application \"\(name)\"\nset active tab index of window \(w) to \(t)\nset index of window \(w) to 1\nactivate\nend tell"
    guard runScript(source) != nil else { throw fail("Couldn't switch tab in \(name)") }
    return "switched"
  }
  let windows = (attr(AXUIElementCreateApplication(app.processIdentifier), "AXWindows") as? [AXUIElement]) ?? []
  guard let i = args["window"] as? Int, i < windows.count else { throw fail("That window is gone") }
  let w = windows[i]
  if (attr(w, "AXMinimized") as? Bool) == true { AXUIElementSetAttributeValue(w, "AXMinimized" as CFString, kCFBooleanFalse) }
  AXUIElementPerformAction(w, "AXRaise" as CFString)
  AXUIElementSetAttributeValue(w, "AXMain" as CFString, kCFBooleanTrue)
  app.activate()
  return "switched"
}

// MARK: - Input safety

/// Process ids of this helper's ancestors: node, the shell, and the terminal app that runs Jev.
let hostPids: Set<pid_t> = {
  var pids = Set<pid_t>()
  var pid = getppid()
  while pid > 1 && !pids.contains(pid) {
    pids.insert(pid)
    var info = kinfo_proc()
    var size = MemoryLayout<kinfo_proc>.stride
    var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, pid]
    guard sysctl(&mib, 4, &info, &size, nil, 0) == 0, size > 0 else { break }
    pid = info.kp_eproc.e_ppid
  }
  return pids
}()

/// Refuses synthetic keyboard/mouse input when it would land in the wrong app:
/// never in the terminal running Jev, and never in an app other than `expected`.
func guardInput(expected: String?) throws {
  guard var front = NSWorkspace.shared.frontmostApplication else { throw fail("No app is in front; not sending input") }
  // You typed the command into the terminal running Jev: bring back the app you were using.
  if hostPids.contains(front.processIdentifier), let target = appBehindHost() {
    target.activate()
    for _ in 0..<20 where NSWorkspace.shared.frontmostApplication?.processIdentifier != target.processIdentifier { waitForIdle(25) }
    front = NSWorkspace.shared.frontmostApplication ?? front
  }
  let name = front.localizedName ?? "unknown app"
  if hostPids.contains(front.processIdentifier) {
    throw fail("\(name) (the terminal running Jev) is in front; refusing to type or click into it")
  }
  if let expected, !expected.isEmpty, name.lowercased() != expected.lowercased() {
    throw fail("Focus moved to \(name) (expected \(expected)); not sending input")
  }
}

/// For element actions: the element's own app must end up in front before input is sent.
func guardOwnerInFront(_ el: AXUIElement) throws {
  var pid: pid_t = 0
  guard AXUIElementGetPid(el, &pid) == .success else { return }
  if hostPids.contains(pid) { throw fail("That element belongs to the terminal running Jev; refusing") }
  if let front = NSWorkspace.shared.frontmostApplication, front.processIdentifier != pid {
    throw fail("\(front.localizedName ?? "Another app") is in front instead of the element's app; not sending input")
  }
}

// MARK: - Main loop

// stdin is read on a background thread; commands run on the main thread, which also
// drives the run loop needed by speech recognition and NSWorkspace callbacks.
Thread.detachNewThread {
  while let line = readLine(strippingNewline: true) {
    guard let data = line.data(using: .utf8),
          let message = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let cmd = message["cmd"] as? String else { continue }
    let rid = message["rid"] ?? NSNull()
    DispatchQueue.main.async {
      do {
        send(["rid": rid, "ok": true, "result": try handle(cmd, message)])
      } catch let error as HelperError {
        send(["rid": rid, "ok": false, "error": error.message])
      } catch {
        send(["rid": rid, "ok": false, "error": error.localizedDescription])
      }
    }
  }
  exit(0)
}

NSApplication.shared.setActivationPolicy(.prohibited)
RunLoop.main.run()
