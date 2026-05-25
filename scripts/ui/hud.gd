class_name Hud
extends CanvasLayer

var game
var root: Control
var title_label: Label
var mode_label: Label
var player_rows: Array[Dictionary] = []
var seed_label: Label

func _ready() -> void:
	layer = 20
	_build()

func _process(_delta: float) -> void:
	if game == null:
		return
	var status := game.get_round_status()
	mode_label.text = "BREACH SECTOR // FFA"
	seed_label.text = "SEED %s" % status["seed"]
	for i in range(player_rows.size()):
		if i >= status["players"].size():
			continue
		var data: Dictionary = status["players"][i]
		var row: Dictionary = player_rows[i]
		row["name"].text = data["name"]
		row["integrity"].value = data["integrity"]
		row["node"].value = 1.0 - clamp(float(data["cooldown"]) / 0.42, 0.0, 1.0)
		row["firewall"].value = 1.0 - clamp(float(data["firewall"]) / 1.65, 0.0, 1.0)
		row["status"].text = "ONLINE" if data["alive"] else "REBOOT"

func _build() -> void:
	root = Control.new()
	root.anchor_right = 1.0
	root.anchor_bottom = 1.0
	add_child(root)

	var top_bar := PanelContainer.new()
	top_bar.position = Vector2(24, 18)
	top_bar.size = Vector2(1232, 74)
	top_bar.add_theme_stylebox_override("panel", _panel_style(Color(0.02, 0.028, 0.045, 0.72), Color(0.0, 0.95, 1.0, 0.18)))
	root.add_child(top_bar)

	var top_layout := HBoxContainer.new()
	top_layout.add_theme_constant_override("separation", 20)
	top_bar.add_child(top_layout)

	var title_box := VBoxContainer.new()
	title_box.custom_minimum_size = Vector2(350, 56)
	top_layout.add_child(title_box)

	title_label = Label.new()
	title_label.text = "GRIDHACK"
	title_label.add_theme_font_size_override("font_size", 26)
	title_label.add_theme_color_override("font_color", Color(0.0, 0.95, 1.0))
	title_box.add_child(title_label)

	mode_label = Label.new()
	mode_label.text = "BREACH SECTOR // FFA"
	mode_label.add_theme_font_size_override("font_size", 13)
	mode_label.add_theme_color_override("font_color", Color(0.78, 0.84, 0.92))
	title_box.add_child(mode_label)

	var rows := HBoxContainer.new()
	rows.add_theme_constant_override("separation", 16)
	rows.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top_layout.add_child(rows)

	for i in range(2):
		rows.add_child(_create_player_row(i))

	seed_label = Label.new()
	seed_label.custom_minimum_size = Vector2(120, 40)
	seed_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	seed_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	seed_label.add_theme_font_size_override("font_size", 13)
	seed_label.add_theme_color_override("font_color", Color(1.0, 0.08, 0.58))
	top_layout.add_child(seed_label)

func _create_player_row(index: int) -> Control:
	var box := PanelContainer.new()
	box.custom_minimum_size = Vector2(280, 54)
	var accent := Color(0.0, 0.95, 1.0) if index == 0 else Color(1.0, 0.08, 0.58)
	box.add_theme_stylebox_override("panel", _panel_style(Color(0.014, 0.017, 0.029, 0.88), Color(accent.r, accent.g, accent.b, 0.24)))

	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 4)
	box.add_child(layout)

	var name_row := HBoxContainer.new()
	layout.add_child(name_row)

	var name_label := Label.new()
	name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_label.add_theme_font_size_override("font_size", 13)
	name_label.add_theme_color_override("font_color", accent)
	name_row.add_child(name_label)

	var status_label := Label.new()
	status_label.add_theme_font_size_override("font_size", 11)
	status_label.add_theme_color_override("font_color", Color(0.78, 0.84, 0.92))
	name_row.add_child(status_label)

	var integrity_bar := ProgressBar.new()
	integrity_bar.max_value = 100
	integrity_bar.show_percentage = false
	integrity_bar.custom_minimum_size = Vector2(240, 7)
	integrity_bar.add_theme_stylebox_override("fill", _bar_style(accent))
	layout.add_child(integrity_bar)

	var charge_row := HBoxContainer.new()
	charge_row.add_theme_constant_override("separation", 8)
	layout.add_child(charge_row)

	var node_charge := ProgressBar.new()
	node_charge.max_value = 1
	node_charge.show_percentage = false
	node_charge.custom_minimum_size = Vector2(112, 5)
	node_charge.add_theme_stylebox_override("fill", _bar_style(Color(0.0, 0.95, 1.0)))
	charge_row.add_child(node_charge)

	var firewall_charge := ProgressBar.new()
	firewall_charge.max_value = 1
	firewall_charge.show_percentage = false
	firewall_charge.custom_minimum_size = Vector2(112, 5)
	firewall_charge.add_theme_stylebox_override("fill", _bar_style(Color(1.0, 0.08, 0.58)))
	charge_row.add_child(firewall_charge)

	player_rows.append({
		"name": name_label,
		"status": status_label,
		"integrity": integrity_bar,
		"node": node_charge,
		"firewall": firewall_charge
	})
	return box

func _panel_style(fill: Color, border: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.border_width_left = 1
	style.border_width_top = 1
	style.border_width_right = 1
	style.border_width_bottom = 1
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	style.content_margin_left = 14
	style.content_margin_right = 14
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	return style

func _bar_style(fill: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.corner_radius_top_left = 0
	style.corner_radius_top_right = 0
	style.corner_radius_bottom_left = 0
	style.corner_radius_bottom_right = 0
	return style
