// JevFixture: a small, deterministic Mac app used by integration tests and evals.
// It mirrors real tasks (fill a field, pick an option, find a code in an email,
// enter it, a destructive button) and writes its state to $JEV_FIXTURE_STATE as JSON
// after every change, so tests can check outcomes without trusting the UI layer.

import AppKit

let statePath = ProcessInfo.processInfo.environment["JEV_FIXTURE_STATE"] ?? "/tmp/jev-fixture-state.json"

struct Email { let sender: String; let subject: String; let body: String }
let inbox = [
  Email(sender: "Newsletter", subject: "Weekly digest", body: "Here is what happened this week."),
  Email(sender: "Indeed", subject: "Your verification code", body: "Your verification code is 482913. It expires in 10 minutes."),
  Email(sender: "Mom", subject: "Dinner on Sunday?", body: "Are you coming for dinner on Sunday?"),
]

final class Controller: NSObject, NSApplicationDelegate, NSTableViewDataSource, NSTableViewDelegate {
  var window: NSWindow!
  let nameField = NSTextField()
  let status = NSTextField(labelWithString: "Ready")
  let subscribe = NSButton(checkboxWithTitle: "Subscribe to newsletter", target: nil, action: nil)
  let color = NSPopUpButton()
  let table = NSTableView()
  let body = NSTextField(wrappingLabelWithString: "Select an email to read it.")
  let codeField = NSTextField()
  var state: [String: Any] = ["greeting": "", "subscribed": false, "color": "Red", "deleted": false, "openedEmail": "", "verified": false, "status": "Ready"]

  func applicationDidFinishLaunching(_ notification: Notification) {
    window = NSWindow(contentRect: NSRect(x: 200, y: 200, width: 560, height: 560), styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
    window.title = "Jev Fixture"

    nameField.placeholderString = "Your name"
    nameField.setAccessibilityLabel("Name")
    let greet = NSButton(title: "Greet", target: self, action: #selector(greetPressed))
    subscribe.target = self
    subscribe.action = #selector(subscribeToggled)
    color.addItems(withTitles: ["Red", "Green", "Blue"])
    color.setAccessibilityLabel("Favorite color")
    color.target = self
    color.action = #selector(colorChanged)
    let delete = NSButton(title: "Delete account", target: self, action: #selector(deletePressed))

    let column = NSTableColumn(identifier: .init("mail"))
    column.title = "Inbox"
    column.width = 500
    table.addTableColumn(column)
    table.dataSource = self
    table.delegate = self
    table.setAccessibilityLabel("Inbox")
    let scroll = NSScrollView()
    scroll.documentView = table
    scroll.hasVerticalScroller = true
    scroll.heightAnchor.constraint(equalToConstant: 110).isActive = true

    codeField.placeholderString = "Verification code"
    codeField.setAccessibilityLabel("Verification code")
    let verify = NSButton(title: "Verify", target: self, action: #selector(verifyPressed))

    let row = { (views: [NSView]) -> NSStackView in let s = NSStackView(views: views); s.orientation = .horizontal; return s }
    let stack = NSStackView(views: [
      row([NSTextField(labelWithString: "Name:"), nameField, greet]),
      row([subscribe, color]),
      NSTextField(labelWithString: "Inbox"),
      scroll,
      body,
      row([codeField, verify]),
      delete,
      status,
    ])
    stack.orientation = .vertical
    stack.alignment = .leading
    stack.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
    nameField.widthAnchor.constraint(equalToConstant: 220).isActive = true
    codeField.widthAnchor.constraint(equalToConstant: 160).isActive = true
    scroll.widthAnchor.constraint(equalToConstant: 520).isActive = true
    window.contentView = stack
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    save()
  }

  func numberOfRows(in tableView: NSTableView) -> Int { inbox.count }

  func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
    NSTextField(labelWithString: "\(inbox[row].sender) — \(inbox[row].subject)")
  }

  func tableViewSelectionDidChange(_ notification: Notification) {
    guard table.selectedRow >= 0 else { return }
    let email = inbox[table.selectedRow]
    body.stringValue = email.body
    set("openedEmail", email.sender)
  }

  @objc func greetPressed() { set("greeting", "Hello, \(nameField.stringValue)!"); setStatus("Greeted \(nameField.stringValue)") }
  @objc func subscribeToggled() { set("subscribed", subscribe.state == .on) }
  @objc func colorChanged() { set("color", color.titleOfSelectedItem ?? "") }
  @objc func deletePressed() { set("deleted", true); setStatus("Account deleted") }
  @objc func verifyPressed() {
    let ok = codeField.stringValue.trimmingCharacters(in: .whitespaces) == "482913"
    set("verified", ok)
    setStatus(ok ? "Verified" : "Wrong code")
  }

  func setStatus(_ text: String) { status.stringValue = text; set("status", text) }

  func set(_ key: String, _ value: Any) {
    state[key] = value
    save()
  }

  func save() {
    state["name"] = nameField.stringValue
    state["code"] = codeField.stringValue
    if let data = try? JSONSerialization.data(withJSONObject: state, options: [.sortedKeys]) {
      try? data.write(to: URL(fileURLWithPath: statePath))
    }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

// Text fields only report changes on commit; save on every keystroke too.
final class FieldObserver: NSObject {
  init(_ controller: Controller) {
    super.init()
    NotificationCenter.default.addObserver(forName: NSControl.textDidChangeNotification, object: nil, queue: .main) { _ in controller.save() }
  }
}

// A standard Edit menu, like every real app has: ⌘A / ⌘C / ⌘V / ⌘Z work through it.
func installMenus() {
  let main = NSMenu()
  let appItem = NSMenuItem()
  appItem.submenu = NSMenu()
  appItem.submenu!.addItem(withTitle: "Quit JevFixture", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
  let editItem = NSMenuItem()
  let edit = NSMenu(title: "Edit")
  edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
  edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
  edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
  edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
  edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
  editItem.submenu = edit
  main.addItem(appItem)
  main.addItem(editItem)
  NSApp.mainMenu = main
}

let app = NSApplication.shared
let controller = Controller()
let observer = FieldObserver(controller)
app.setActivationPolicy(.regular)
installMenus()
app.delegate = controller
app.run()
