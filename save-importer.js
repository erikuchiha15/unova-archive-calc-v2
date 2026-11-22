"use strict";

(function(root) {
  const PARTY_OFFSET = 0x18E00;
  const PARTY_RECORD_OFFSET = 8;
  const PARTY_RECORD_SIZE = 220;
  const BOX_RECORD_SIZE = 136;

  const BLOCK_ORDER = [
    "ABCD","ABDC","ACBD","ACDB","ADBC","ADCB",
    "BACD","BADC","BCAD","BCDA","BDAC","BDCA",
    "CABD","CADB","CBAD","CBDA","CDAB","CDBA",
    "DABC","DACB","DBAC","DBCA","DCAB","DCBA"
  ];

  function read16(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function read32(bytes, offset) {
    return (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }

  function write16(bytes, offset, value) {
    bytes[offset] = value & 255;
    bytes[offset + 1] = (value >>> 8) & 255;
  }

  function nextSeed(seed) {
    return (Math.imul(seed, 0x41C64E6D) + 0x6073) >>> 0;
  }

  function cryptWords(bytes, seed) {
    const result = new Uint8Array(bytes.length);

    for (let i = 0; i < bytes.length; i += 2) {
      seed = nextSeed(seed);

      const word = read16(bytes, i) ^ (seed >>> 16);

      write16(result, i, word);
    }

    return result;
  }

  function checksum(bytes) {
    let sum = 0;

    for (let i = 0; i < 128; i += 2)
      sum = (sum + read16(bytes, i)) & 65535;

    return sum;
  }

  function decodePokemon(record) {
    if (!(record instanceof Uint8Array) ||
        record.length < BOX_RECORD_SIZE)
      throw Error("Invalid Pokémon record");

    const personality = read32(record, 0);
    const expectedChecksum = read16(record, 6);

    const encrypted = record.slice(8, 136);
    const shuffled = cryptWords(encrypted, expectedChecksum);

    if (checksum(shuffled) !== expectedChecksum)
      throw Error("Pokémon checksum mismatch");

    const order = BLOCK_ORDER[
      ((personality >>> 13) & 31) % 24
    ];
    const blocks = {};

    for (let i = 0; i < 4; i++) {
      blocks[order[i]] = shuffled.slice(
        i * 32, (i + 1) * 32
      );
    }

    const a = blocks.A;
    const b = blocks.B;

    const ivWord = read32(b, 16);

    const result = {
      personality,
      speciesId: read16(a, 0),
      heldItemId: read16(a, 2),
      trainerId: read32(a, 4),
      abilityId: a[13],
      natureId: personality % 25,
      evs: {
        hp:a[16], atk:a[17], def:a[18],
        spe:a[19], spa:a[20], spd:a[21]
      },
      moves: [
        read16(b, 0),
        read16(b, 2),
        read16(b, 4),
        read16(b, 6)
      ],
      ivs: {
        hp:ivWord & 31,
        atk:(ivWord >>> 5) & 31,
        def:(ivWord >>> 10) & 31,
        spe:(ivWord >>> 15) & 31,
        spa:(ivWord >>> 20) & 31,
        spd:(ivWord >>> 25) & 31
      },
      isEgg: Boolean((ivWord >>> 30) & 1),
      checksumValid: true
    };

    if (record.length >= PARTY_RECORD_SIZE) {
      const party = cryptWords(
        record.slice(136, 220),
        personality
      );

      result.level = party[4];
      result.currentHP = read16(party, 6);
      result.maxHP = read16(party, 8);
    }

    return result;
  }

  function decodeParty(buffer) {
    const bytes = buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);

    if (bytes.length !== 524288)
      throw Error(
        "Expected a 512 KB Pokémon White 2 .sav file"
      );

    const count = bytes[PARTY_OFFSET + 4];

    if (count > 6)
      throw Error("Invalid party count");

    const pokemon = [];

    for (let slot = 0; slot < count; slot++) {
      const offset = PARTY_OFFSET +
        PARTY_RECORD_OFFSET +
        slot * PARTY_RECORD_SIZE;

      const record = bytes.slice(
        offset, offset + PARTY_RECORD_SIZE
      );

      pokemon.push({
        slot:slot + 1,
        ...decodePokemon(record)
      });
    }

    return pokemon;
  }

  const api = {
    decodePokemon,
    decodeParty,
    checksum,
    cryptWords,
    nextSeed
  };

  if (typeof module !== "undefined" && module.exports)
    module.exports = api;

  root.UnovaSaveImporter = api;

})(typeof window !== "undefined" ? window : globalThis);
