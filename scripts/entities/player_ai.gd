class_name PlayerAI
extends Node2D

var game
var arena: ArenaGrid
var player_id := 1
var display_name := "INTRUSION AI"
var accent_color := Color(0.0, 0.95, 1.0)
var spawn_cell := Vector2i.ZERO
var speed := 178.0
var node_cooldown := 0.42
var node_cooldown_remaining := 0.0
var firewall_cooldown := 1.65
var firewall_cooldown_remaining := 0.0
var max_active_nodes := 2
var active_node_count := 0
var integrity := 100.0
var is_alive := true
var is_bot := false
var bot_target := Vector2.ZERO
var bot_decision_time := 0.0
var respawn_time := 0.0
var last_move := Vector2.RIGHT

func _ready() -> void:
	global_position = arena.cell_to_world(spawn_cell)
	bot_target = global_position
	z_index = 12

func _process(delta: float) -> void:
	node_cooldown_remaining = max(0.0, node_cooldown_remaining - delta)
	firewall_cooldown_remaining = max(0.0, firewall_cooldown_remaining - delta)

	if not is_alive:
		respawn_time -= delta
		if respawn_time <= 0.0:
			_respawn()
		queue_redraw()
		return

	var movement := _get_bot_movement(delta) if is_bot else _get_human_movement()
	_move(movement, delta)
	_apply_stream_drift(delta)

	if is_bot:
		_bot_actions(delta)
	else:
		_human_actions()

	queue_redraw()

func _draw() -> void:
	if not is_alive:
		draw_circle(Vector2.ZERO, 22.0, Color(accent_color.r, accent_color.g, accent_color.b, 0.08))
		draw_arc(Vector2.ZERO, 22.0, 0.0, TAU, 18, Color(accent_color.r, accent_color.g, accent_color.b, 0.22), 1.5)
		return

	var shield_alpha := 0.10 + 0.06 * sin(Time.get_ticks_msec() * 0.008)
	draw_circle(Vector2.ZERO, 24.0, Color(accent_color.r, accent_color.g, accent_color.b, shield_alpha))
	var body := PackedVector2Array([
		Vector2(0, -21),
		Vector2(17, -8),
		Vector2(12, 15),
		Vector2(0, 22),
		Vector2(-13, 12),
		Vector2(-18, -8)
	])
	draw_colored_polygon(body, Color(0.012, 0.016, 0.028, 0.94))
	body.append(body[0])
	draw_polyline(body, accent_color, 2.3)
	draw_line(Vector2(-8, -2), Vector2(9, -2), Color(1.0, 1.0, 1.0, 0.52), 1.2)
	draw_line(Vector2(0, -17), last_move.normalized() * 18.0, Color(accent_color.r, accent_color.g, accent_color.b, 0.82), 2.0)

	var bar_width := 34.0
	draw_rect(Rect2(Vector2(-bar_width * 0.5, 28), Vector2(bar_width, 4)), Color(0.08, 0.08, 0.11, 0.9), true)
	draw_rect(Rect2(Vector2(-bar_width * 0.5, 28), Vector2(bar_width * integrity / 100.0, 4)), accent_color, true)

func apply_corruption(amount: float, _attacker: PlayerAI) -> void:
	if not is_alive:
		return
	integrity -= amount
	if integrity <= 0.0:
		is_alive = false
		respawn_time = 1.6
		integrity = 0.0

func _respawn() -> void:
	is_alive = true
	integrity = 100.0
	active_node_count = 0
	global_position = arena.cell_to_world(spawn_cell)

func _get_human_movement() -> Vector2:
	var direction := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		direction.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		direction.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		direction.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		direction.y += 1.0
	return direction.normalized()

func _human_actions() -> void:
	if Input.is_key_pressed(KEY_SPACE):
		_try_deploy()
	if Input.is_key_pressed(KEY_SHIFT):
		_try_firewall()

func _get_bot_movement(delta: float) -> Vector2:
	bot_decision_time -= delta
	if bot_decision_time <= 0.0 or global_position.distance_to(bot_target) < 16.0:
		bot_decision_time = arena.rng.randf_range(0.32, 0.82)
		var target_cell := arena.get_random_walkable_cell()
		if game.players.size() > 0 and arena.rng.randf() < 0.62:
			var opponent: PlayerAI = game.players[0]
			var opponent_cell := arena.world_to_cell(opponent.global_position)
			var offset := Vector2i(arena.rng.randi_range(-3, 3), arena.rng.randi_range(-2, 2))
			target_cell = opponent_cell + offset
			if not arena.is_walkable(target_cell):
				target_cell = arena.get_random_walkable_cell()
		bot_target = arena.cell_to_world(target_cell)
	return (bot_target - global_position).normalized()

func _bot_actions(_delta: float) -> void:
	var opponent: PlayerAI = game.players[0]
	if global_position.distance_to(opponent.global_position) < arena.tile_size * 2.7 and arena.rng.randf() < 0.035:
		_try_deploy()
	if arena.rng.randf() < 0.012:
		_try_firewall()

func _move(direction: Vector2, delta: float) -> void:
	if direction.length_squared() > 0.01:
		last_move = direction
	var movement := direction * speed * delta
	var target := global_position + movement
	if arena.is_walkable(arena.world_to_cell(target)):
		global_position = target
		return

	var x_target := Vector2(target.x, global_position.y)
	if arena.is_walkable(arena.world_to_cell(x_target)):
		global_position = x_target
	var y_target := Vector2(global_position.x, target.y)
	if arena.is_walkable(arena.world_to_cell(y_target)):
		global_position = y_target

func _apply_stream_drift(delta: float) -> void:
	var cell := arena.world_to_cell(global_position)
	if not arena.streams.has(cell):
		return
	var to_cell: Vector2i = arena.streams[cell]
	var drift := (arena.cell_to_world(to_cell) - arena.cell_to_world(cell)).normalized()
	var target := global_position + drift * 46.0 * delta
	if arena.is_walkable(arena.world_to_cell(target)):
		global_position = target

func _try_deploy() -> void:
	if node_cooldown_remaining > 0.0 or active_node_count >= max_active_nodes:
		return
	var cell := arena.world_to_cell(global_position)
	if game.deploy_infection(self, cell):
		active_node_count += 1
		node_cooldown_remaining = node_cooldown

func _try_firewall() -> void:
	if firewall_cooldown_remaining > 0.0:
		return
	var target_cell := arena.world_to_cell(global_position + last_move.normalized() * arena.tile_size)
	if game.try_raise_firewall(self, target_cell):
		firewall_cooldown_remaining = firewall_cooldown
