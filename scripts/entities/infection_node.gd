class_name InfectionNode
extends Node2D

var owner: PlayerAI
var arena: ArenaGrid
var resolver: PropagationResolver
var game
var cell := Vector2i.ZERO
var arm_time := 1.65
var propagation_radius := 5
var payload_color := Color(0.0, 0.95, 1.0)
var elapsed := 0.0
var detonation_started := false
var chain_warning := false

func _ready() -> void:
	global_position = arena.cell_to_world(cell)
	z_index = 8

func _process(delta: float) -> void:
	elapsed += delta
	if not detonation_started and elapsed >= arm_time:
		_detonate()
	queue_redraw()

func _draw() -> void:
	var t := clamp(elapsed / arm_time, 0.0, 1.0)
	var pulse := 0.65 + 0.35 * sin(elapsed * 15.0)
	var warning_alpha := 0.26 + 0.46 * t
	if chain_warning:
		warning_alpha = 0.86

	draw_circle(Vector2.ZERO, 21.0 + 5.0 * pulse, Color(payload_color.r, payload_color.g, payload_color.b, 0.10))
	draw_arc(Vector2.ZERO, 22.0, -PI * 0.5, -PI * 0.5 + TAU * t, 28, Color(payload_color.r, payload_color.g, payload_color.b, warning_alpha), 3.0)

	var body := PackedVector2Array([
		Vector2(0, -16),
		Vector2(15, -3),
		Vector2(8, 15),
		Vector2(-11, 12),
		Vector2(-16, -6)
	])
	draw_colored_polygon(body, Color(0.02, 0.03, 0.05, 0.92))
	body.append(body[0])
	draw_polyline(body, payload_color, 2.0)
	draw_line(Vector2(-7, 0), Vector2(8, 0), Color(1.0, 1.0, 1.0, 0.34), 1.0)

func chain_trigger(delay: float) -> void:
	if detonation_started:
		return
	chain_warning = true
	arm_time = min(arm_time, elapsed + delay)

func _detonate() -> void:
	if detonation_started:
		return
	detonation_started = true
	visible = false
	resolver.propagate_from(self, cell, propagation_radius, payload_color)
	if owner != null:
		owner.active_node_count = max(0, owner.active_node_count - 1)
	game.unregister_infection(cell, self)
	await get_tree().create_timer(0.42).timeout
	queue_free()
