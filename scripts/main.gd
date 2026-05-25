extends Node2D

const ArenaGridScript := preload("res://scripts/systems/arena_grid.gd")
const PropagationResolverScript := preload("res://scripts/systems/propagation_resolver.gd")
const PlayerAIScript := preload("res://scripts/entities/player_ai.gd")
const InfectionNodeScript := preload("res://scripts/entities/infection_node.gd")
const HudScript := preload("res://scripts/ui/hud.gd")

var arena: ArenaGrid
var resolver: PropagationResolver
var hud: Hud
var players: Array[PlayerAI] = []
var active_nodes: Dictionary = {}
var sector_seed := 7331
var round_time := 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_boot_sector()

func _process(delta: float) -> void:
	round_time += delta
	queue_redraw()

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_R:
			sector_seed += 97
			_boot_sector()

func _draw() -> void:
	var viewport := get_viewport_rect().size
	draw_rect(Rect2(Vector2.ZERO, viewport), Color(0.01, 0.012, 0.02), true)
	for i in range(22):
		var y := fmod(round_time * 14.0 + float(i) * 43.0, viewport.y)
		var alpha := 0.025 + 0.025 * sin(round_time * 1.7 + float(i))
		draw_line(Vector2(0.0, y), Vector2(viewport.x, y + 24.0), Color(0.0, 0.95, 1.0, alpha), 1.0)

func _boot_sector() -> void:
	for child in get_children():
		child.queue_free()

	active_nodes.clear()
	players.clear()
	round_time = 0.0

	arena = ArenaGridScript.new()
	arena.name = "ArenaGrid"
	arena.sector_seed = sector_seed
	add_child(arena)
	arena.generate()

	resolver = PropagationResolverScript.new()
	resolver.name = "PropagationResolver"
	resolver.arena = arena
	resolver.game = self
	add_child(resolver)

	_spawn_players()

	hud = HudScript.new()
	hud.name = "HUD"
	hud.game = self
	add_child(hud)

func _spawn_players() -> void:
	var p1 := PlayerAIScript.new()
	p1.name = "IntrusionAI_01"
	p1.player_id = 1
	p1.display_name = "NULL VECTOR"
	p1.accent_color = Color(0.0, 0.95, 1.0)
	p1.spawn_cell = arena.player_spawns[0]
	p1.arena = arena
	p1.game = self
	add_child(p1)
	players.append(p1)

	var p2 := PlayerAIScript.new()
	p2.name = "IntrusionAI_02"
	p2.player_id = 2
	p2.display_name = "RED GHOST"
	p2.accent_color = Color(1.0, 0.08, 0.58)
	p2.spawn_cell = arena.player_spawns[1]
	p2.is_bot = true
	p2.arena = arena
	p2.game = self
	add_child(p2)
	players.append(p2)

func deploy_infection(owner: PlayerAI, cell: Vector2i) -> bool:
	if not arena.can_place_node(cell):
		return false
	if active_nodes.has(cell):
		return false

	var node := InfectionNodeScript.new()
	node.name = "InfectionNode_%s_%s" % [cell.x, cell.y]
	node.owner = owner
	node.cell = cell
	node.arena = arena
	node.resolver = resolver
	node.game = self
	node.payload_color = owner.accent_color
	active_nodes[cell] = node
	add_child(node)
	return true

func unregister_infection(cell: Vector2i, node: InfectionNode) -> void:
	if active_nodes.get(cell) == node:
		active_nodes.erase(cell)

func try_raise_firewall(owner: PlayerAI, cell: Vector2i) -> bool:
	if not arena.can_place_temp_firewall(cell):
		return false
	arena.set_temp_firewall(cell, owner.player_id, 2.4)
	return true

func resolve_corruption_cell(cell: Vector2i, source: InfectionNode, intensity: float) -> void:
	if arena.damage_soft_firewall(cell):
		return

	var chained: InfectionNode = active_nodes.get(cell)
	if source != null and chained != null and chained != source:
		chained.chain_trigger(0.08)

	for player in players:
		if player.is_alive and arena.world_to_cell(player.global_position) == cell:
			var attacker: PlayerAI = source.owner if source != null else null
			player.apply_corruption(38.0 * intensity, attacker)

	if source != null and arena.is_unstable(cell):
		resolver.emit_static_burst(cell, source.owner, source.payload_color)

func get_round_status() -> Dictionary:
	var status := {
		"time": round_time,
		"seed": sector_seed,
		"players": []
	}
	for player in players:
		status["players"].append({
			"name": player.display_name,
			"integrity": player.integrity,
			"cooldown": player.node_cooldown_remaining,
			"firewall": player.firewall_cooldown_remaining,
			"alive": player.is_alive,
			"color": player.accent_color
		})
	return status
