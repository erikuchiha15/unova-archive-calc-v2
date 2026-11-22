const $ = id => document.getElementById(id);
let currentTrainer = null;
let allTrainers = [];
let allSpecies = [];

function filterOptions(select, entries, query, label, value) {
  const previous = select.value;
  const term = query.trim().toLowerCase();

  const filtered = entries.filter(entry =>
    label(entry).toLowerCase().includes(term) ||
    String(value(entry)).includes(term)
  );

  fill(select, filtered, label, value);

  if (filtered.some(entry => String(value(entry)) === previous)) {
    select.value = previous;
  }

  return select.value !== previous;
}

const TYPE_COLORS = {
  Normal:"#9299a1",Fire:"#e76d45",Water:"#4d91db",
  Electric:"#d7ae34",Grass:"#56a866",Ice:"#66bfc5",
  Fighting:"#b95448",Poison:"#9362b3",Ground:"#ba914d",
  Flying:"#7e9ad5",Psychic:"#d96e9b",Bug:"#86a342",
  Rock:"#a69765",Ghost:"#7560a4",Dragon:"#6967c9",
  Dark:"#655d70",Steel:"#778e9e"
};

const STAT_LABELS = {
  hp:"HP",atk:"ATK",def:"DEF",
  spa:"SPA",spd:"SPD",spe:"SPE"
};

function showStats(elementId, stats) {
  const container = $(elementId);
  container.replaceChildren();

  if (!stats) return;

  for (const [key,label] of Object.entries(STAT_LABELS)) {
    const pill = document.createElement("div");
    pill.className = "stat-pill";

    const title = document.createElement("small");
    title.textContent = label;

    const value = document.createElement("strong");
    value.textContent = stats[key] ?? "—";

    pill.append(title,value);
    container.append(pill);
  }
}

function typeBadge(type) {
  const badge = document.createElement("span");
  badge.className = "type-badge";
  badge.textContent = type;
  badge.style.backgroundColor = TYPE_COLORS[type] || "#6e6482";
  return badge;
}

function updateMoveDetails() {
  const pokemon = currentTrainer?.pokemon.find(
    p => String(p.slot) === $("attacker").value
  );

  const move = pokemon?.moves.find(
    m => String(m.id) === $("move").value
  );

  if (!move) {
    $("moveDetails").textContent = "";
    return;
  }

  $("moveDetails").replaceChildren();

  $("moveDetails").append(typeBadge(move.type));

  const detail = document.createElement("span");
  detail.textContent =
    move.category + " · " +
    (move.power ? move.power + " BP" : "Variable/Status") +
    " · Accuracy " + (move.accuracy ?? "—");

  $("moveDetails").append(detail);
}

let calculationTimer = null;

const STATS = ["hp","atk","def","spa","spd","spe"];
const NATURES = [
  "Hardy","Lonely","Brave","Adamant","Naughty",
  "Bold","Docile","Relaxed","Impish","Lax",
  "Timid","Hasty","Serious","Jolly","Naive",
  "Modest","Mild","Quiet","Bashful","Rash",
  "Calm","Gentle","Sassy","Careful","Quirky"
];

function scheduleCalculation() {
  clearTimeout(calculationTimer);
  calculationTimer = setTimeout(() => {
    if ($("move").value && $("defender").value) calculate();
  }, 250);
}

function updateEVTotal() {
  const total = STATS.reduce(
    (sum, stat) => sum + Number($("ev_" + stat).value || 0), 0
  );
  $("evTotal").textContent = "Total EVs: " + total + " / 510";
  return total;
}

function buildAttackerStatControls() {
  for (const [prefix, defaultValue, max] of [
    ["attIV",31,31],["attEV",0,252]
  ]) {
    const container = $(prefix + "Grid");

    for (const stat of STATS) {
      const label = document.createElement("label");
      label.textContent = stat.toUpperCase();

      const input = document.createElement("input");
      input.id = prefix + "_" + stat;
      input.type = "number";
      input.min = 0;
      input.max = max;
      input.value = defaultValue;

      input.addEventListener("input", () => {
        updateAttackerEVTotal();
        scheduleCalculation();
      });

      label.append(input);
      container.append(label);
    }
  }
}

function updateAttackerEVTotal() {
  const total = STATS.reduce(
    (sum, stat) => sum + Number($("attEV_" + stat).value || 0), 0
  );
  $("attEVTotal").textContent = "Total EVs: " + total + " / 510";
}

function buildBoostControls() {
  for (const [containerId, prefix] of [
    ["attackerBoosts","atkBoost_"],
    ["defenderBoosts","defBoost_"]
  ]) {
    const container = $(containerId);

    for (const stat of ["atk","def","spa","spd","spe"]) {
      const label = document.createElement("label");
      label.textContent = stat.toUpperCase();

      const select = document.createElement("select");
      select.id = prefix + stat;

      for (let stage = -6; stage <= 6; stage++) {
        const option = document.createElement("option");
        option.value = stage;
        option.textContent = stage > 0 ? "+" + stage : String(stage);
        if (stage === 0) option.selected = true;
        select.append(option);
      }

      select.addEventListener("change", scheduleCalculation);
      select.addEventListener("change", () => {
        if (typeof scheduleV2Matchup === "function")
          scheduleV2Matchup();
      });
      label.append(select);
      container.append(label);
    }
  }
}

function buildStatControls() {
  for (const [prefix, defaultValue, max] of [
    ["iv",31,31],["ev",0,252]
  ]) {
    const container = $(prefix + "Grid");

    for (const stat of STATS) {
      const label = document.createElement("label");
      label.textContent = stat.toUpperCase();

      const input = document.createElement("input");
      input.id = prefix + "_" + stat;
      input.type = "number";
      input.min = 0;
      input.max = max;
      input.value = defaultValue;

      input.addEventListener("input", () => {
        updateEVTotal();
        scheduleCalculation();
      });

      label.append(input);
      container.append(label);
    }
  }
}

function addOptions(select, values, emptyLabel) {
  select.replaceChildren();

  if (emptyLabel) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyLabel;
    select.append(option);
  }

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value.name;
    option.textContent = value.name;
    select.append(option);
  }
}



// Local compatibility bridge for existing damage requests.
async function v2BrowserFetch(path, options = {}) {
  try {
    const data = await window.UnovaBrowserAPI.request(
      path, options
    );

    return {
      ok:true,
      status:200,
      json:async () => data
    };
  } catch (error) {
    return {
      ok:false,
      status:400,
      json:async () => ({
        error:error.message || String(error)
      })
    };
  }
}

async function api(path) {
  return window.UnovaBrowserAPI.request(path);
}

function fill(select, entries, label, value) {
  select.replaceChildren();
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = value(entry);
    option.textContent = label(entry);
    select.append(option);
  }
}

function showError(error) {
  $("results").textContent = error.message;
  $("results").className = "results error";
}

async function loadTrainer() {
  try {
    currentTrainer = await api("/api/trainer?id=" +
      encodeURIComponent($("trainer").value));

    fill($("attacker"), currentTrainer.pokemon,
      p => `${p.species} · Lv${p.level} · Slot ${p.slot}`,
      p => p.slot);

    loadPokemon();
    refreshV2TeamSlots();
  } catch (error) {
    showError(error);
  }
}

function loadPokemon() {
  const pokemon = currentTrainer?.pokemon.find(
    p => String(p.slot) === $("attacker").value
  );
  if (!pokemon) return;

  $("attackerDetails").textContent =
    `${pokemon.nature} · ${pokemon.ability || "Unknown ability"} · ` +
    `${pokemon.item || "No held item"}`;

  showStats("attackerStats", pokemon.stats);

  fill(
    $("move"),
    pokemon.moves,
    m => String(m.name || "Unknown Move"),
    m => Number(m.id)
  );
  updateMoveDetails();
}

async function calculate() {
  $("calculate").disabled = true;
  $("results").className = "results";
  $("results").textContent = "Calculating...";

  try {
    const query = new URLSearchParams({
      trainer: $("trainer").value,
      slot: $("attacker").value,
      move: $("move").value,
      defender: $("defender").value,
      level: $("level").value,
      currentHP: $("currentHP").value,
      defenderStatus: $("defenderStatus").value,
      magnitude: $("magnitude").value,
      remainingPP: $("remainingPP").value,
      attackerCurrentHP: $("attackerCurrentHP").value,
      receivedDamage: $("receivedDamage").value,
      stockpileCount: $("stockpileCount").value,
      unavailablePartySlots: $("unavailablePartySlots").value,
      nature: $("nature").value,
      ability: $("ability").value,
      item: $("item").value,
      weather: $("weather").value,
      reflect: $("reflect").checked,
      lightScreen: $("lightScreen").checked,
      critical: $("critical").checked,
      burn: $("burn").checked,
      gameType: $("gameType").value,
      helpingHand: $("helpingHand").checked,
      friendGuard: $("friendGuard").checked,
      gravity: $("gravity").checked,
      stealthRock: $("stealthRock").checked,
      spikes: $("spikes").value,
      customAttacker: $("customAttacker").checked,
      attNature: $("attNature").value,
      attAbility: $("attAbility").value,
      attItem: $("attItem").value
    });

    for (const stat of STATS) {
      query.set("iv_" + stat, $("iv_" + stat).value);
      query.set("ev_" + stat, $("ev_" + stat).value);
    }

    for (const stat of ["atk","def","spa","spd","spe"]) {
      query.set("atkBoost_" + stat, $("atkBoost_" + stat).value);
      query.set("defBoost_" + stat, $("defBoost_" + stat).value);
    }

    for (const stat of STATS) {
      query.set("attIV_" + stat, $("attIV_" + stat).value);
      query.set("attEV_" + stat, $("attEV_" + stat).value);
    }

    const result = await api("/api/calculate?" + query);

    $("results").replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent =
      `${result.attacker} → ${result.defender}`;
    $("results").append(heading);

    const subtitle = document.createElement("p");
    subtitle.className = "result-subtitle";
    subtitle.textContent =
      result.move + " · " +
      (result.moveType || result.category || "Special mechanic");
    $("results").append(subtitle);

    const damage = document.createElement("div");
    damage.className = "damage";
    damage.textContent = result.damage
      ? `${result.damage.minimum}–${result.damage.maximum} HP`
      : result.requiresContext
        ? "Additional battle context required"
        : "Status move";
    $("results").append(damage);

    if (result.damagePercent) {
      const bar = document.createElement("div");
      bar.className = "damage-bar";

      const fill = document.createElement("div");
      fill.className = "damage-bar-fill";
      fill.style.width =
        Math.min(100,result.damagePercent.maximum) + "%";

      bar.append(fill);
      $("results").append(bar);

      const label = document.createElement("div");
      label.className = "damage-bar-label";
      label.textContent =
        "Maximum damage relative to defender HP";
      $("results").append(label);
    }

    if (result.damagePercent) {
      const percent = document.createElement("div");
      percent.className = "damage-percent";
      percent.textContent =
        "Approximately " +
        result.damagePercent.minimum + "–" +
        result.damagePercent.maximum + "% of defender HP";
      $("results").append(percent);
    }

    if (result.attackerStats) {
      showStats("attackerStats", result.attackerStats);
    }

    showStats("defenderStats", result.defenderStats);

    if (result.hazards && result.hazards.total > 0) {
      const hazards = document.createElement("div");
      hazards.className = "hazard-summary";
      hazards.textContent =
        "Switch-in hazards: " + result.hazards.total +
        " HP (Stealth Rock: " + result.hazards.stealthRock +
        ", Spikes: " + result.hazards.spikes +
        "). Remaining HP: " + result.hazards.remainingHP +
        ". Separate from attack damage.";
      $("results").append(hazards);
    }

    const description = document.createElement("p");
    description.className = "result-description";
    description.textContent =
      result.description || result.note || "";
    $("results").append(description);
  } catch (error) {
    showError(error);
  } finally {
    $("calculate").disabled = false;
  }
}


let importedParty = [];
let importedMoveNames = {};
let v2MovePriorities = {};

function updateSavePlayerMoves() {
  const pokemon = importedParty.find(
    p => String(p.slot) === $("savePokemon").value
  );

  if (!pokemon) {
    $("savePlayerMove").replaceChildren();
    return;
  }

  const moveOptions = pokemon.moves
    .filter(id => Number(id) > 0)
    .map(id => ({
      id,
      name: importedMoveNames[String(id)] ||
        "Move #" + id
    }));

  fill(
    $("savePlayerMove"),
    moveOptions,
    move => move.name,
    move => move.id
  );
}

function updateSaveDirection() {
  const playerAttacking =
    $("saveDirection").value === "player";

  $("savePlayerMove").disabled = !playerAttacking;
  $("saveTrainerMove").disabled = playerAttacking;
}

function updateSaveTrainerMoves() {
  const pokemon = currentTrainer?.pokemon.find(
    p => String(p.slot) === $("attacker").value
  );

  const moves = pokemon?.moves || [];

  fill(
    $("saveTrainerMove"),
    moves,
    m => m.name || "Unknown Move",
    m => m.id
  );
}

async function loadSaveFile() {
  const file = $("saveFile").files[0];
  if (!file) return;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const decoded = window.UnovaSaveImporter.decodeParty(bytes);

    importedParty = decoded;
    v2ImportedStats = {};

    const moveIds = [...new Set(
      decoded.flatMap(p => p.moves).filter(Boolean)
    )];

    const moveData = await api("/api/save-moves");

    importedMoveNames = Object.fromEntries(
      (moveData.moves || []).map(
        move => [String(move.id),move.name]
      )
    );

    v2MovePriorities = Object.fromEntries(
      (moveData.moves || []).map(
        move => [String(move.id),move.priority]
      )
    );

    fill(
      $("savePokemon"),
      decoded,
      p => {
        const species = allSpecies.find(
          s => Number(s.id) === p.speciesId
        );
        return "Slot " + p.slot + " · " +
          (species?.name || "Species " + p.speciesId) +
          " · Lv" + p.level;
      },
      p => p.slot
    );

    $("saveBattleControls").hidden = false;
    refreshV2TeamSlots();
    $("saveImportStatus").textContent =
      "Loaded " + decoded.length +
      " Pokémon locally from " + file.name;

    updateSaveTrainerMoves();
    updateSavePlayerMoves();
    updateSaveDirection();
    scheduleV2Matchup();

  } catch (error) {
    importedParty = [];
    $("saveBattleControls").hidden = true;
    $("saveImportStatus").textContent =
      "Import failed: " + error.message;
  }
}

async function calculateSaveMatchup() {
  try {
    const pokemon = importedParty.find(
      p => String(p.slot) === $("savePokemon").value
    );

    if (!pokemon)
      throw Error("Select an imported Pokémon");

    const direction = $("saveDirection").value;

    const moveId = direction === "player"
      ? Number($("savePlayerMove").value)
      : Number($("saveTrainerMove").value);

    if (!moveId)
      throw Error("No available move");

    const response = await v2BrowserFetch("/api/save-battle",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        imported:pokemon,
        importedParty,
        trainerId:Number($("trainer").value),
        trainerSlot:Number($("attacker").value),
        moveId,
        direction,
        specialOptions:{
          magnitude:Number($("saveMagnitude").value),
          remainingPP:Number($("saveRemainingPP").value),
          stockpileCount:Number($("saveStockpile").value),
          attackerCurrentHP:$("saveAttackerHP").value === ""
            ? undefined
            : Number($("saveAttackerHP").value),
          defenderCurrentHP:$("saveDefenderHP").value === ""
            ? undefined
            : Number($("saveDefenderHP").value),
          receivedDamage:Number($("saveReceivedDamage").value)
        }
      })
    });

    const result = await response.json();

    if (!response.ok)
      throw Error(result.error || "Calculation failed");

    $("saveBattleResults").textContent =
      result.attacker + " → " + result.defender +
      " | " + result.move + " | " +
      (result.damage
        ? result.damage.minimum + "–" +
          result.damage.maximum + " HP (" +
          result.damagePercent.minimum + "–" +
          result.damagePercent.maximum + "%)"
        : result.note || "No direct damage");

  } catch (error) {
    $("saveBattleResults").textContent =
      "Error: " + error.message;
  }
}


// V2 automatic team matchup calculations
let v2MatchupVersion = 0;
let v2MatchupTimer = null;

function scheduleV2Matchup() {
  clearTimeout(v2MatchupTimer);
  const version = ++v2MatchupVersion;

  v2MatchupTimer = setTimeout(() => {
    calculateV2Matchup(version);
  }, 180);
}

async function calculateV2Matchup(version = ++v2MatchupVersion) {
  const output = $("saveBattleResults");

  const pokemon = importedParty.find(
    p => String(p.slot) === $("savePokemon").value
  );

  if (!pokemon || !currentTrainer) {
    output.textContent = "Import a save and select a trainer.";
    return;
  }

  const trainerPokemon = currentTrainer.pokemon.find(
    p => String(p.slot) === $("attacker").value
  );

  if (!trainerPokemon) {
    output.textContent = "Select a trainer Pokémon.";
    return;
  }

  const playerMoves = pokemon.moves
    .map(Number)
    .filter(id => id > 0);

  const trainerMoves = (trainerPokemon.moves || [])
    .map(m => Number(m.id))
    .filter(id => id > 0);

  output.textContent = "Calculating both Pokémon's moves...";

  const specialOptions = {
    magnitude:Number($("saveMagnitude").value),
    remainingPP:Number($("saveRemainingPP").value),
    stockpileCount:Number($("saveStockpile").value),
    attackerCurrentHP:$("saveAttackerHP").value === ""
      ? undefined : Number($("saveAttackerHP").value),
    defenderCurrentHP:$("saveDefenderHP").value === ""
      ? undefined : Number($("saveDefenderHP").value),
    receivedDamage:Number($("saveReceivedDamage").value)
  };

  const jobs = [
    ...playerMoves.map(moveId => ({moveId,direction:"player"})),
    ...trainerMoves.map(moveId => ({moveId,direction:"trainer"}))
  ];

  const results = await Promise.allSettled(
    jobs.map(async job => {
      const calculateHit = async isCrit => {
      const response = await v2BrowserFetch("/api/save-battle", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          imported:pokemon,
          importedParty,
          trainerId:Number($("trainer").value),
          trainerSlot:Number($("attacker").value),
          moveId:job.moveId,
          direction:job.direction,
          moveOptions:{isCrit},
          entryHazards:{
            player:{
              stealthRock:$("playerStealthRock").checked,
              spikes:Number($("playerSpikes").value)
            },
            trainer:{
              stealthRock:$("trainerStealthRock").checked,
              spikes:Number($("trainerSpikes").value)
            }
          },
          battleConditions:{
            gameType:$("gameType").value,
            weather:$("weather").value,
            gravity:$("gravity").checked,
            player:{
              reflect:$("playerReflect").checked,
              lightScreen:$("playerLightScreen").checked,
              helpingHand:$("playerHelpingHand").checked,
              friendGuard:$("playerFriendGuard").checked,
              burned:$("playerBurned").checked
            },
            trainer:{
              reflect:$("trainerReflect").checked,
              lightScreen:$("trainerLightScreen").checked,
              helpingHand:$("trainerHelpingHand").checked,
              friendGuard:$("trainerFriendGuard").checked,
              burned:$("trainerBurned").checked
            }
          },
          battleStages:{
            player:Object.fromEntries(
              ["atk","def","spa","spd","spe"].map(
                stat => [
                  stat,
                  Number($("defBoost_" + stat).value)
                ]
              )
            ),
            trainer:Object.fromEntries(
              ["atk","def","spa","spd","spe"].map(
                stat => [
                  stat,
                  Number($("atkBoost_" + stat).value)
                ]
              )
            )
          },
          specialOptions
        })
      });

      const data = await response.json();

      if (!response.ok)
        throw Error(data.error || "Calculation failed");

      return data;
      };

      const normal = await calculateHit(false);
      const critical = normal.damage
        ? await calculateHit(true)
        : null;

      return {normal,critical};
    })
  );

  if (version !== v2MatchupVersion) return;

  output.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "v2-move-results";

  for (const direction of ["player","trainer"]) {
    const column = document.createElement("div");
    column.className = "v2-move-column";

    const heading = document.createElement("h3");
    heading.textContent = direction === "player"
      ? "Your Pokémon Attacks"
      : "Trainer Pokémon Attacks";

    column.append(heading);

    jobs.forEach((job,index) => {
      if (job.direction !== direction) return;

      const result = results[index];

      const card = document.createElement("div");
      card.className = "v2-move-card";

      if (result.status === "rejected") {
        card.textContent =
          "Move #" + job.moveId + ": " + result.reason.message;
      } else {
        const data = result.value.normal;
        const critical = result.value.critical;

        const name = document.createElement("strong");
        name.textContent = data.move || "Unknown Move";

        const damage = document.createElement("span");

        damage.textContent = data.damage
          ? data.damage.minimum + "–" +
            data.damage.maximum + " HP (" +
            data.damagePercent.minimum + "–" +
            data.damagePercent.maximum + "%)"
          : data.note || "No direct damage";

        const details = document.createElement("div");
        details.className = "v2-damage-pair";

        const normalLine = document.createElement("span");
        normalLine.textContent = "Normal: " + damage.textContent;

        details.append(normalLine);

        if (critical?.damage && critical.damagePercent) {
          const criticalLine = document.createElement("span");
          criticalLine.className = "v2-critical-damage";
          criticalLine.textContent =
            "Critical: " +
            critical.damage.minimum + "–" +
            critical.damage.maximum + " HP (" +
            critical.damagePercent.minimum + "–" +
            critical.damagePercent.maximum + "%)";

          details.append(criticalLine);
        }

        card.append(name,details);
      }

      column.append(card);
    });

    wrapper.append(column);
  }

  const successful = results.find(
    result => result.status === "fulfilled"
  );

  if (successful?.value?.normal?.entryHazards) {
    const hazards = successful.value.normal.entryHazards;

    const hasHazards =
      hazards.player.total > 0 ||
      hazards.trainer.total > 0;

    if (hasHazards) {
    const summary = document.createElement("div");
    summary.className = "v2-hazard-summary";

    for (const [label,data] of [
      ["Your Pokémon",hazards.player],
      ["Trainer Pokémon",hazards.trainer]
    ]) {
      const card = document.createElement("div");
      card.className = "v2-hazard-card";

      const heading = document.createElement("strong");
      heading.textContent = label;

      const hp = document.createElement("span");
      hp.textContent =
        data.remainingHP + "/" + data.maximumHP + " HP";

      const track = document.createElement("div");
      track.className = "v2-hp-track";

      const bar = document.createElement("div");
      bar.className = "v2-hp-fill";

      const percent = data.maximumHP > 0
        ? Math.max(0,Math.min(100,
            data.remainingHP / data.maximumHP * 100))
        : 0;

      bar.style.width = percent + "%";
      track.append(bar);

      const breakdown = document.createElement("small");
      breakdown.textContent =
        "Stealth Rock: " + data.stealthRock +
        " HP · Spikes: " + data.spikes + " HP";

      card.append(heading,hp,track,breakdown);
      summary.append(card);
    }

    output.append(summary);
    }
  }

  output.append(wrapper);
}


// V2 clickable team selection
function renderV2TeamSlots(containerId, selectId) {
  const container = $(containerId);
  const select = $(selectId);

  container.replaceChildren();

  for (const option of select.options) {
    if (!option.value) continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "v2-team-slot";

    if (option.value === select.value)
      button.classList.add("active");

    const name = document.createElement("span");

    const playerTeam = containerId === "v2PlayerTeam";

    const pokemon = playerTeam
      ? importedParty.find(
          p => String(p.slot) === option.value
        )
      : currentTrainer?.pokemon.find(
          p => String(p.slot) === option.value
        );

    const speciesId = playerTeam
      ? pokemon?.speciesId
      : pokemon?.speciesId;

    const species = allSpecies.find(
      s => Number(s.id) === Number(speciesId)
    );

    const speciesName =
      species?.name ||
      pokemon?.species ||
      option.textContent;

    const spriteName = String(speciesName)
      .toLowerCase()
      .replace(/[^a-z0-9]/g,"");

    const sprite = document.createElement("img");
    sprite.className = "v2-pokemon-sprite";
    sprite.alt = "";
    sprite.loading = "lazy";
    sprite.src =
      "https://play.pokemonshowdown.com/sprites/gen5/" +
      spriteName + ".png";

    sprite.onerror = () => {
      sprite.style.visibility = "hidden";
    };

    name.textContent = speciesName;

    const level = document.createElement("small");
    level.textContent = pokemon?.level
      ? "Lv" + pokemon.level
      : "";

    button.append(sprite,name,level);

    button.addEventListener("click", () => {
      select.value = option.value;
      select.dispatchEvent(new Event("change",{
        bubbles:true
      }));

      renderV2TeamSlots(containerId,selectId);
    });

    container.append(button);
  }
}


// V2 move-order selection
function refreshV2MoveOrderSelectors() {
  const player = importedParty.find(
    p => String(p.slot) === $("savePokemon").value
  );

  const trainer = currentTrainer?.pokemon.find(
    p => String(p.slot) === $("attacker").value
  );

  const playerSelect = $("v2PlayerOrderMove");
  const trainerSelect = $("v2TrainerOrderMove");

  const populate = (select, moves) => {
    const previous = select.value;
    select.replaceChildren();

    for (const move of moves) {
      const option = document.createElement("option");
      option.value = String(move.id);
      option.textContent =
        move.name + " (" +
        (move.priority >= 0 ? "+" : "") +
        move.priority + ")";
      select.append(option);
    }

    if ([...select.options].some(o => o.value === previous))
      select.value = previous;
  };

  const playerMoves = (player?.moves || [])
    .filter(id => Number(id) > 0)
    .map(id => ({
      id:Number(id),
      name:importedMoveNames[String(id)] || "Move #" + id,
      priority:v2MovePriorities[String(id)]
    }));

  const trainerMoves = (trainer?.moves || [])
    .filter(move => Number(move.id) > 0)
    .map(move => ({
      id:move.id,
      name:move.name,
      priority:move.priority
    }));

  populate(playerSelect,playerMoves);
  populate(trainerSelect,trainerMoves);
}

function refreshV2TeamSlots() {
  renderV2TeamSlots("v2PlayerTeam","savePokemon");
  renderV2TeamSlots("v2TrainerTeam","attacker");
  refreshV2MoveOrderSelectors();
  renderV2StatComparison();
  renderV2MoveOrder();
  loadV2ImportedStats().catch(console.error);
}


// V2 Pokémon stat comparison

let v2ImportedStats = {};

async function loadV2ImportedStats() {
  const player = importedParty.find(
    p => String(p.slot) === $("savePokemon").value
  );

  if (!player) return;

  const slot = String(player.slot);

  if (!v2ImportedStats[slot]) {
    const params = new URLSearchParams({
      pokemon:JSON.stringify(player)
    });

    v2ImportedStats[slot] =
      await api("/api/imported-stats?" + params);
  }

  renderV2StatComparison();
}


// Generation 5 Speed comparison

// Generation 5 effective Speed with common battle modifiers.

// Generation 5 Speed modifiers, matching @smogon/calc 0.12.0
// for the supported abilities, items, and conditions.
function v2EffectiveSpeed(rawSpeed, stage, options = {}) {
  const speed = Number(rawSpeed);
  const boost = Math.max(-6, Math.min(6, Number(stage) || 0));

  if (!Number.isFinite(speed) || speed < 1)
    return null;

  const ability = String(options.ability || "").toLowerCase();
  const item = String(options.item || "").toLowerCase();
  const weather = String(options.weather || "").toLowerCase();

  const numerator = boost >= 0 ? 2 + boost : 2;
  const denominator = boost >= 0 ? 2 : 2 - boost;

  let result = Math.floor(speed * numerator / denominator);

  const mods = [];

  if (options.tailwind)
    mods.push(8192);

  const unburden =
    ability === "unburden" && Boolean(options.unburden);

  if (
    unburden ||
    (ability === "swift swim" && weather === "rain") ||
    (ability === "chlorophyll" && weather === "sun") ||
    (ability === "sand rush" && weather === "sand")
  ) {
    mods.push(8192);
  } else if (ability === "quick feet" && options.statused) {
    mods.push(6144);
  } else if (ability === "slow start" && options.slowStart) {
    mods.push(2048);
  }

  if (!unburden) {
    if (item === "choice scarf") {
      mods.push(6144);
    } else if (
      item === "iron ball" ||
      item === "macho brace" ||
      item === "power anklet" ||
      item === "power band" ||
      item === "power belt" ||
      item === "power bracer" ||
      item === "power lens" ||
      item === "power weight"
    ) {
      mods.push(2048);
    }
  }

  // @smogon/calc-style fixed-point modifier chaining.
  let modifier = 4096;

  for (const mod of mods) {
    modifier = (modifier * mod + 2048) >> 12;
  }

  modifier = Math.max(410, Math.min(131172, modifier));

  // Pokémon rounding: nearest integer, with halves rounded down.
  result = Math.floor(result * modifier / 4096 + 0.499999);

  if (options.paralyzed && ability !== "quick feet")
    result = Math.floor(result * 25 / 100);

  return Math.max(0, Math.min(10000, result));
}


// V2 move-priority and turn-order prediction
function renderV2MoveOrder() {
  const output = $("v2MoveOrderResult");
  const playerSelect = $("v2PlayerOrderMove");
  const trainerSelect = $("v2TrainerOrderMove");

  const player = importedParty.find(
    p => String(p.slot) === $("savePokemon").value
  );

  const trainer = currentTrainer?.pokemon.find(
    p => String(p.slot) === $("attacker").value
  );

  const playerInfo =
    v2ImportedStats[String(player?.slot)] || {};

  if (!player || !trainer || !playerInfo.stats?.spe ||
      !playerSelect.value || !trainerSelect.value) {
    output.textContent = "Select two moves to compare turn order.";
    return;
  }

  const playerMoveId = playerSelect.value;
  const trainerMoveId = trainerSelect.value;

  const playerPriority = v2MovePriorities[playerMoveId];

  const trainerMove = trainer.moves.find(
    m => String(m.id) === trainerMoveId
  );

  const trainerPriority = trainerMove?.priority;

  if (!Number.isInteger(playerPriority) ||
      !Number.isInteger(trainerPriority)) {
    output.textContent = "Move priority data unavailable.";
    return;
  }

  const playerSpeed = v2EffectiveSpeed(
    playerInfo.stats.spe,
    $("defBoost_spe").value,
    {
      ability:playerInfo.ability,
      item:playerInfo.item,
      weather:$("weather").value,
      paralyzed:$("v2PlayerParalyzed").checked,
      statused:$("v2PlayerParalyzed").checked ||
        $("playerBurned").checked,
      tailwind:$("v2PlayerTailwind").checked,
      unburden:$("v2PlayerUnburden").checked
    }
  );

  const trainerSpeed = v2EffectiveSpeed(
    trainer.stats?.spe,
    $("atkBoost_spe").value,
    {
      ability:trainer.ability,
      item:trainer.item,
      weather:$("weather").value,
      paralyzed:$("v2TrainerParalyzed").checked,
      statused:$("v2TrainerParalyzed").checked ||
        $("trainerBurned").checked,
      tailwind:$("v2TrainerTailwind").checked,
      unburden:$("v2TrainerUnburden").checked
    }
  );

  const playerName =
    allSpecies.find(s => Number(s.id) === player.speciesId)
      ?.name || "Your Pokémon";

  const trainerName = trainer.species || "Trainer Pokémon";

  let winner;
  let reason;

  if (playerPriority !== trainerPriority) {
    winner = playerPriority > trainerPriority
      ? playerName : trainerName;

    reason = "Higher move priority";
  } else if (playerSpeed === trainerSpeed) {
    winner = null;
    reason = "Speed tie — order is randomized";
  } else {
    const playerFirst = $("v2TrickRoom").checked
      ? playerSpeed < trainerSpeed
      : playerSpeed > trainerSpeed;

    winner = playerFirst ? playerName : trainerName;

    reason = $("v2TrickRoom").checked
      ? "Trick Room reverses Speed order"
      : "Higher effective Speed";
  }

  const playerMoveName =
    importedMoveNames[playerMoveId] || "Unknown Move";

  const trainerMoveName =
    trainerMove?.name || "Unknown Move";

  const conditionalMoves = new Set([
    "Sucker Punch",
    "Pursuit",
    "Focus Punch",
    "Avalanche",
    "Revenge",
    "Counter",
    "Mirror Coat",
    "Metal Burst",
    "Bide",
    "Me First",
    "After You",
    "Quash"
  ]);

  const conditional =
    conditionalMoves.has(playerMoveName) ||
    conditionalMoves.has(trainerMoveName);

  const priorityAbilities = new Set([
    "Prankster",
    "Gale Wings",
    "Triage",
    "Stall"
  ]);

  const abilityWarning =
    priorityAbilities.has(playerInfo.ability) ||
    priorityAbilities.has(trainer.ability);

  output.replaceChildren();

  const heading = document.createElement("strong");
  heading.textContent = winner
    ? "Expected First: " + winner
    : "Turn Order: Speed tie";

  const details = document.createElement("div");
  details.textContent =
    playerMoveName + " (" +
    (playerPriority >= 0 ? "+" : "") +
    playerPriority + ") vs. " +
    trainerMoveName + " (" +
    (trainerPriority >= 0 ? "+" : "") +
    trainerPriority + ") — " + reason;

  const note = document.createElement("small");

  note.textContent =
    conditional || abilityWarning
      ? "Warning: Conditional moves or priority-changing abilities may alter this prediction."
      : "Assumes no unmodeled turn-order effects.";

  output.append(heading,details,note);
}

function renderV2SpeedComparison() {
  const output = $("v2SpeedResult");

  const player = importedParty.find(
    p => String(p.slot) === $("savePokemon").value
  );

  const trainer = currentTrainer?.pokemon.find(
    p => String(p.slot) === $("attacker").value
  );

  const playerStats =
    v2ImportedStats[String(player?.slot)]?.stats;

  if (!player || !trainer || !playerStats?.spe) {
    output.textContent = "Waiting for Pokémon Speed data.";
    return;
  }

  const playerInfo =
    v2ImportedStats[String(player.slot)] || {};

  const playerSpeed = v2EffectiveSpeed(
    playerStats.spe,
    $("defBoost_spe").value,
    {
      ability:playerInfo.ability,
      item:playerInfo.item,
      weather:$("weather").value,
      paralyzed:$("v2PlayerParalyzed").checked,
      statused:$("v2PlayerParalyzed").checked ||
        $("playerBurned").checked,
      tailwind:$("v2PlayerTailwind").checked,
      unburden:$("v2PlayerUnburden").checked
    }
  );

  const trainerSpeed = v2EffectiveSpeed(
    trainer.stats?.spe,
    $("atkBoost_spe").value,
    {
      ability:trainer.ability,
      item:trainer.item,
      weather:$("weather").value,
      paralyzed:$("v2TrainerParalyzed").checked,
      statused:$("v2TrainerParalyzed").checked ||
        $("trainerBurned").checked,
      tailwind:$("v2TrainerTailwind").checked,
      unburden:$("v2TrainerUnburden").checked
    }
  );

  if (playerSpeed === null || trainerSpeed === null) {
    output.textContent = "Speed data unavailable.";
    return;
  }

  const trickRoom = $("v2TrickRoom").checked;

  const playerName =
    allSpecies.find(s => Number(s.id) === player.speciesId)
      ?.name || "Your Pokémon";

  const trainerName = trainer.species || "Trainer Pokémon";

  let result;

  if (playerSpeed === trainerSpeed) {
    result = "Speed tie — turn order is randomized.";
  } else {
    const playerFirst = trickRoom
      ? playerSpeed < trainerSpeed
      : playerSpeed > trainerSpeed;

    result = (playerFirst ? playerName : trainerName) +
      " acts first at equal move priority.";
  }

  output.replaceChildren();

  const heading = document.createElement("strong");
  heading.textContent = "Who Moves First? " + result;

  const details = document.createElement("div");
  details.textContent =
    playerName + ": " + playerSpeed +
    " Speed | " +
    trainerName + ": " + trainerSpeed +
    " Speed" +
    (trickRoom ? " | Trick Room active" : "");

  const note = document.createElement("small");
  note.textContent =
    "Assumes equal move priority. Some abilities, items, and other turn-order effects are not modeled.";

  output.append(heading,details,note);
  renderV2MoveOrder();
}

function renderV2StatComparison() {
  const output = $("v2StatComparisonContent");

  const player = importedParty.find(
    p => String(p.slot) === $("savePokemon").value
  );

  const trainer = currentTrainer?.pokemon.find(
    p => String(p.slot) === $("attacker").value
  );

  if (!player || !trainer) {
    output.textContent =
      "Import your save and select a trainer Pokémon.";
    return;
  }

  const species = allSpecies.find(
    s => Number(s.id) === player.speciesId
  );

  const playerName = species?.name || "Your Pokémon";
  const trainerName = trainer.species || "Trainer Pokémon";

  const stats = [
    ["hp","HP"],
    ["atk","Attack"],
    ["def","Defense"],
    ["spa","Sp. Atk"],
    ["spd","Sp. Def"],
    ["spe","Speed"]
  ];

  const table = document.createElement("table");
  table.className = "v2-stat-table";

  const header = document.createElement("tr");

  for (const text of ["Stat",playerName,trainerName]) {
    const th = document.createElement("th");
    th.textContent = text;
    header.append(th);
  }

  table.append(header);

  for (const [key,label] of stats) {
    const row = document.createElement("tr");

    const heading = document.createElement("td");
    heading.textContent = label;

    const playerCell = document.createElement("td");
    const trainerCell = document.createElement("td");

    const playerStat = document.createElement("strong");
    playerStat.textContent =
      v2ImportedStats[String(player.slot)]?.stats?.[key]
      ?? (key === "hp" ? player.maxHP : "—");

    const playerDetails = document.createElement("small");
    playerDetails.textContent =
      "IV " + (player.ivs?.[key] ?? "—") +
      " · EV " + (player.evs?.[key] ?? "—");

    const trainerStat = document.createElement("strong");
    trainerStat.textContent =
      trainer.stats?.[key] ?? "—";

    const trainerDetails = document.createElement("small");
    trainerDetails.textContent =
      "IV " + (trainer.ivs?.[key] ?? "—") +
      " · EV " + (trainer.evs?.[key] ?? "—");

    playerCell.append(playerStat,playerDetails);
    trainerCell.append(trainerStat,trainerDetails);

    row.append(heading,playerCell,trainerCell);
    table.append(row);
  }

  output.replaceChildren(table);
  renderV2SpeedComparison();
}

async function init() {
  try {
    const [trainers, species, options] = await Promise.all([
      api("/api/trainers"),
      api("/api/species"),
      api("/api/options")
    ]);

    buildStatControls();
    buildBoostControls();
    buildAttackerStatControls();

    for (const id of [
      "v2PlayerOrderMove",
      "v2TrainerOrderMove"
    ]) {
      $(id).addEventListener(
        "change",
        renderV2MoveOrder
      );
    }

    // Attach Speed listeners after stat-stage controls exist.
    for (const id of [
      "v2TrickRoom",
      "v2PlayerParalyzed",
      "v2TrainerParalyzed",
      "defBoost_spe",
      "atkBoost_spe",
      "weather",
      "playerBurned",
      "trainerBurned",
      "v2PlayerTailwind",
      "v2TrainerTailwind",
      "v2PlayerUnburden",
      "v2TrainerUnburden"
    ]) {
      const control = $(id);

      if (!control) {
        throw Error("Missing Speed control: " + id);
      }

      control.addEventListener(
        "change",
        renderV2SpeedComparison
      );
    }
    addOptions($("attNature"), NATURES.map(name => ({name})));
    addOptions($("attAbility"), options.abilities, "Default ability");
    addOptions($("attItem"), options.items, "No held item");
    addOptions($("nature"), NATURES.map(name => ({name})));
    addOptions($("ability"), options.abilities, "Default species ability");
    addOptions($("item"), options.items, "No held item");

    allTrainers = trainers;
    allSpecies = species;

    fill($("trainer"), allTrainers,
      t => `#${t.id} ${t.name}`, t => t.id);

    fill($("defender"), allSpecies,
      p => `#${p.id} ${p.name}`, p => p.id);

    $("trainerSearch").addEventListener("input", () => {
      const changed = filterOptions(
        $("trainer"), allTrainers, $("trainerSearch").value,
        t => "#" + t.id + " " + t.name, t => t.id
      );
      if (changed && $("trainer").value) loadTrainer();
    });

    $("defenderSearch").addEventListener("input", () => {
      const changed = filterOptions(
        $("defender"), allSpecies, $("defenderSearch").value,
        p => "#" + p.id + " " + p.name, p => p.id
      );
      if (changed && $("defender").value) scheduleCalculation();
    });

    $("trainer").addEventListener("change", loadTrainer);
    $("attacker").addEventListener("change", loadPokemon);
    $("calculate").addEventListener("click", calculate);

    for (const id of ["defender","level","nature","ability","item","currentHP",
      "defenderStatus","magnitude","remainingPP",
      "attackerCurrentHP","receivedDamage",
      "stockpileCount","unavailablePartySlots"]) {
      $(id).addEventListener("change", scheduleCalculation);
    }

    $("move").addEventListener("change", () => {
      updateMoveDetails();
      scheduleCalculation();
    });

    $("customAttacker").addEventListener("change", () => {
      $("attackerCustomPanel").hidden = !$("customAttacker").checked;
      scheduleCalculation();
    });

    for (const id of ["attNature","attAbility","attItem"]) {
      $(id).addEventListener("change", scheduleCalculation);
    }

    for (const id of [
      "weather","reflect","lightScreen","critical","burn",
      "gameType","helpingHand","friendGuard","stealthRock","spikes",
      "gravity"
    ]) {
      $(id).addEventListener("change", scheduleCalculation);
    }

    $("saveFile").addEventListener("change",loadSaveFile);
    $("saveCalculate").addEventListener("click",() => calculateV2Matchup());
    $("saveDirection").addEventListener("change",updateSaveDirection);
    $("savePokemon").addEventListener("change",() => {
      updateSavePlayerMoves();
      scheduleV2Matchup();
    });
    $("attacker").addEventListener("change",() => {
      updateSaveTrainerMoves();
      scheduleV2Matchup();
    });
    $("trainer").addEventListener("change",() =>
      setTimeout(() => {
        updateSaveTrainerMoves();
        scheduleV2Matchup();
      },200)
    );


    for (const id of [
      "saveMagnitude","saveRemainingPP","saveStockpile",
      "saveAttackerHP","saveDefenderHP","saveReceivedDamage"
    ]) {
      $(id).addEventListener("change",scheduleV2Matchup);
    }


    for (const id of [
      "gameType","weather","gravity",
      "playerReflect","playerLightScreen",
      "playerHelpingHand","playerFriendGuard",
      "trainerReflect","trainerLightScreen",
      "trainerHelpingHand","trainerFriendGuard",
      "playerBurned","trainerBurned",
      "playerStealthRock","playerSpikes",
      "trainerStealthRock","trainerSpikes"
    ]) {
      $(id).addEventListener("change",scheduleV2Matchup);
    }

    $("savePokemon").addEventListener(
      "change",refreshV2TeamSlots
    );
    $("attacker").addEventListener(
      "change",refreshV2TeamSlots
    );

    await loadTrainer();
    updateSaveTrainerMoves();
    $("results").textContent = "Ready to calculate.";
  } catch (error) {
    showError(error);
  }
}

init();
