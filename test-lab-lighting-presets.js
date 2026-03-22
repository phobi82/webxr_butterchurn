// Isolated single-effect presets for TestLab.html.

const buildTestLabSoftWash = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hueA = wrapUnit(0.54 + timeSeconds * 0.02 + metrics.colorMomentum * 0.03);
	const hueB = wrapUnit(hueA + 0.06);
	if (variantKey === "wall") {
		addFixture(state, "wash", "wall", timeSeconds * 0.04 + 1.18, hslToRgb(hueA, 0.8, 0.58), 0.22 + metrics.roomFill * 0.14, 1.02, {
			softness: 0.38,
			sweep: 0.16,
			vertical: 0.56,
			stereoBias: -1,
			effectMode: FIXTURE_EFFECT_MODE_NONE
		});
		addFixture(state, "wash", "wall", -(timeSeconds * 0.035) + 4.72, hslToRgb(hueB, 0.74, 0.62), 0.22 + metrics.roomFill * 0.14, 1.02, {
			softness: 0.4,
			sweep: 0.16,
			vertical: 0.56,
			stereoBias: 1,
			effectMode: FIXTURE_EFFECT_MODE_NONE
		});
		applyFixtureGroupsToLightingState(state, 0.2);
		return;
	}
	if (variantKey === "floor") {
		addFixture(state, "wash", "floor", timeSeconds * 0.04 + 0.62, hslToRgb(hueA, 0.78, 0.56), 0.2 + metrics.bassHit * 0.18 + metrics.roomFill * 0.1, 1.1, {
			softness: 0.42,
			sweep: 0.08,
			effectMode: FIXTURE_EFFECT_MODE_NONE
		});
		addFixture(state, "wash", "floor", -(timeSeconds * 0.03) + 3.46, hslToRgb(hueB, 0.72, 0.6), 0.18 + metrics.bassHit * 0.16 + metrics.roomFill * 0.1, 1.02, {
			softness: 0.44,
			sweep: 0.08,
			effectMode: FIXTURE_EFFECT_MODE_NONE
		});
		applyFixtureGroupsToLightingState(state, 0.18);
		return;
	}
	addFixture(state, "wash", "ceiling", timeSeconds * 0.04 - 0.22, hslToRgb(hueA, 0.82, 0.58), 0.34 + metrics.roomFill * 0.18, 1.2, {
		softness: 0.4,
		sweep: 0.12,
		effectMode: FIXTURE_EFFECT_MODE_NONE
	});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.035) + 0.34, hslToRgb(hueB, 0.76, 0.62), 0.3 + metrics.roomFill * 0.16, 1.08, {
		softness: 0.42,
		sweep: 0.1,
		effectMode: FIXTURE_EFFECT_MODE_NONE
	});
	applyFixtureGroupsToLightingState(state, 0.28);
};

const buildTestLabShutters = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hueA = wrapUnit(0.96 + timeSeconds * 0.035 + metrics.colorMomentum * 0.03);
	const hueB = wrapUnit(hueA + 0.09);
	if (variantKey === "wall") {
		addFixture(state, "wash", "wall", timeSeconds * 0.06 + 1.1, hslToRgb(hueA, 0.9, 0.6), 0.24 + metrics.roomFill * 0.14, 0.88, {
			softness: 0.24,
			sweep: 0.22,
			vertical: 0.58,
			stereoBias: -1,
			effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
		});
		addFixture(state, "wash", "wall", -(timeSeconds * 0.05) + 4.8, hslToRgb(hueB, 0.82, 0.62), 0.22 + metrics.roomFill * 0.12, 0.82, {
			softness: 0.24,
			sweep: 0.2,
			vertical: 0.58,
			stereoBias: 1,
			effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
		});
		applyFixtureGroupsToLightingState(state, 0.18);
		return;
	}
	addFixture(state, "wash", "ceiling", timeSeconds * 0.06 - 0.18, hslToRgb(hueA, 0.92, 0.6), 0.34 + metrics.roomFill * 0.16, 0.96, {
		softness: 0.26,
		sweep: 0.18,
		effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
	});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.05) + 0.42, hslToRgb(hueB, 0.84, 0.62), 0.28 + metrics.roomFill * 0.14, 0.84, {
		softness: 0.28,
		sweep: 0.16,
		effectMode: FIXTURE_EFFECT_MODE_SHUTTERS
	});
	applyFixtureGroupsToLightingState(state, 0.22);
};

const buildTestLabEdgeRunner = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const leftHue = wrapUnit(0.58 + timeSeconds * 0.06);
	const rightHue = wrapUnit(leftHue + 0.34);
	if (variantKey === "ceiling") {
		addFixture(state, "beam", "ceiling", timeSeconds * 0.44 + 0.9, hslToRgb(leftHue, 0.98, 0.62), 0.24 + metrics.leftImpact * 0.5 + metrics.motionEnergy * 0.14, 0.26, {
			softness: 0.04,
			sweep: 1.22,
			effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER
		});
		addFixture(state, "beam", "ceiling", -(timeSeconds * 0.42) + 3.8, hslToRgb(rightHue, 0.98, 0.62), 0.24 + metrics.rightImpact * 0.5 + metrics.motionEnergy * 0.14, 0.26, {
			softness: 0.04,
			sweep: 1.22,
			effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER
		});
		applyFixtureGroupsToLightingState(state, 0.12);
		return;
	}
	addFixture(state, "beam", "wall", timeSeconds * 0.48 + 1.8, hslToRgb(leftHue, 0.98, 0.62), 0.36 + metrics.leftImpact * 0.82 + metrics.stereoWidth * 0.18, 0.28, {
		softness: 0.05,
		sweep: 1.36,
		vertical: 0.7,
		stereoBias: -1,
		effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER
	});
	addFixture(state, "beam", "wall", -(timeSeconds * 0.46) + 4.9, hslToRgb(rightHue, 0.98, 0.62), 0.36 + metrics.rightImpact * 0.82 + metrics.stereoWidth * 0.18, 0.28, {
		softness: 0.05,
		sweep: 1.36,
		vertical: 0.7,
		stereoBias: 1,
		effectMode: FIXTURE_EFFECT_MODE_EDGE_RUNNER
	});
	applyFixtureGroupsToLightingState(state, 0.16);
};

const buildTestLabSilhouetteCut = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hue = wrapUnit(0.1 + timeSeconds * 0.08);
	addFixture(state, "strobe", variantKey === "ceiling" ? "ceiling" : "wall", timeSeconds * 0.44 + 1.2, hslToRgb(hue, 1, 0.72), 0.28 + metrics.transientGate * 0.44 + metrics.strobeGate * 0.26, 0.24, {
		softness: 0.04,
		sweep: variantKey === "ceiling" ? 0.66 : 0.72,
		vertical: variantKey === "ceiling" ? 0.55 : 0.7,
		strobeAmount: metrics.strobeGate,
		effectMode: FIXTURE_EFFECT_MODE_SILHOUETTE
	});
	applyFixtureGroupsToLightingState(state, 0.1);
};

const buildTestLabRoomWindowBeat = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hue = wrapUnit(0.34 + timeSeconds * 0.08);
	addFixture(state, "strobe", variantKey === "ceiling" ? "ceiling" : "wall", timeSeconds * 0.52 + 1.4, hslToRgb(hue, 0.98, 0.68), 0.26 + metrics.beatPulse * 0.38 + metrics.strobeGate * 0.24, 0.24, {
		softness: 0.04,
		sweep: variantKey === "ceiling" ? 0.7 : 0.76,
		vertical: variantKey === "ceiling" ? 0.56 : 0.68,
		strobeAmount: metrics.strobeGate,
		effectMode: FIXTURE_EFFECT_MODE_WINDOW_BEAT
	});
	applyFixtureGroupsToLightingState(state, 0.1);
};

const buildTestLabAuroraCurtain = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const bandHueA = wrapUnit(0.34 + timeSeconds * 0.004 + metrics.colorMomentum * 0.012);
	const bandHueB = wrapUnit(bandHueA + 0.1);
	const bandHueC = wrapUnit(bandHueA + 0.22);
	if (variantKey === "wall") {
		addFixture(state, "wash", "wall", timeSeconds * 0.06 + 1.1, hslToRgb(bandHueA, 0.88, 0.56), 0.26 + metrics.roomFill * 0.18, 0.74, {
			softness: 0.24,
			sweep: 0.2,
			vertical: 0.54,
			stereoBias: -1,
			effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
		});
		addFixture(state, "wash", "wall", -(timeSeconds * 0.05) + 4.76, hslToRgb(bandHueB, 0.82, 0.6), 0.22 + metrics.roomFill * 0.16, 0.7, {
			softness: 0.24,
			sweep: 0.18,
			vertical: 0.54,
			stereoBias: 1,
			effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
		});
		addFixture(state, "wash", "wall", timeSeconds * 0.04 + 2.96, hslToRgb(bandHueC, 0.76, 0.62), 0.18 + metrics.roomFill * 0.14, 0.64, {
			softness: 0.24,
			sweep: 0.16,
			vertical: 0.62,
			effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
		});
		applyFixtureGroupsToLightingState(state, 0.18);
		return;
	}
	addFixture(state, "wash", "ceiling", timeSeconds * 0.06 + 0.18, hslToRgb(bandHueA, 0.88, 0.56), 0.42 + metrics.roomFill * 0.28, 0.82, {
		softness: 0.28,
		sweep: 0.18,
		effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
	});
	addFixture(state, "wash", "ceiling", -(timeSeconds * 0.05) + 0.72, hslToRgb(bandHueB, 0.82, 0.6), 0.38 + metrics.roomFill * 0.26, 0.76, {
		softness: 0.3,
		sweep: 0.18,
		effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
	});
	addFixture(state, "wash", "ceiling", timeSeconds * 0.04 + 1.34, hslToRgb(bandHueC, 0.76, 0.62), 0.34 + metrics.roomFill * 0.22, 0.7, {
		softness: 0.32,
		sweep: 0.16,
		effectMode: FIXTURE_EFFECT_MODE_AURORA_CURTAIN
	});
	applyFixtureGroupsToLightingState(state, 0.24);
};

const buildTestLabFloorHalo = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const hueA = wrapUnit(0.98 + timeSeconds * 0.04);
	const hueB = wrapUnit(hueA + 0.42);
	addFixture(state, "wash", "floor", timeSeconds * 0.16 + 0.8 + (variantKey === "directional" ? -0.42 : 0), hslToRgb(hueA, 0.9, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, variantKey === "directional" ? 0.84 : 0.96, {
		softness: variantKey === "directional" ? 0.28 : 0.34,
		sweep: 0.12,
		effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO
	});
	addFixture(state, "wash", "floor", -(timeSeconds * 0.14) + 3.1 + (variantKey === "directional" ? 0.52 : 0), hslToRgb(hueB, 0.88, 0.58), 0.24 + metrics.bassHit * 0.34 + metrics.kickGate * 0.16, variantKey === "directional" ? 0.72 : 0.92, {
		softness: variantKey === "directional" ? 0.26 : 0.34,
		sweep: 0.12,
		effectMode: FIXTURE_EFFECT_MODE_FLOOR_HALO
	});
	applyFixtureGroupsToLightingState(state, 0.18);
};

const buildTestLabFlashlight = function(state, timeSeconds, audioMetrics, variantKey) {
	const metrics = getHybridClubMetrics(audioMetrics);
	const beamColor = hslToRgb(wrapUnit(0.12 + timeSeconds * 0.01), 0.12, 0.86);
	if (variantKey === "wall") {
		addFixture(state, "beam", "wall", 3.14, beamColor, 0.34 + metrics.level * 0.16 + metrics.transient * 0.08, 0.42, {
			softness: 0.08,
			sweep: 0.22,
			vertical: 0.64,
			effectMode: FIXTURE_EFFECT_MODE_FLASHLIGHT
		});
		applyFixtureGroupsToLightingState(state, 0.08);
		return;
	}
	if (variantKey === "floor") {
		addFixture(state, "wash", "floor", 2.9, beamColor, 0.28 + metrics.level * 0.12 + metrics.bassHit * 0.12, 0.56, {
			softness: 0.1,
			sweep: 0.1,
			effectMode: FIXTURE_EFFECT_MODE_FLASHLIGHT
		});
		applyFixtureGroupsToLightingState(state, 0.06);
		return;
	}
	addFixture(state, "beam", "ceiling", 0.22, beamColor, 0.32 + metrics.level * 0.14 + metrics.roomFill * 0.1, 0.46, {
		softness: 0.08,
		sweep: 0.18,
		effectMode: FIXTURE_EFFECT_MODE_FLASHLIGHT
	});
	applyFixtureGroupsToLightingState(state, 0.08);
};

const createTestLabVariantDefinition = function(args) {
	return {
		variantKey: args.variantKey,
		variantLabel: args.variantLabel,
		surfaceKey: args.surfaceKey,
		buildState: args.buildState
	};
};

const testLabLightingEffectDefinitions = [
	{
		effectName: "Soft Wash",
		effectDescription: "Broad diffuse room-light fill for neutral tint-versus-reveal evaluation.",
		variants: [
			createTestLabVariantDefinition({
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				buildState: buildTestLabSoftWash
			}),
			createTestLabVariantDefinition({
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				buildState: buildTestLabSoftWash
			}),
			createTestLabVariantDefinition({
				variantKey: "floor",
				variantLabel: "Floor",
				surfaceKey: "floor",
				buildState: buildTestLabSoftWash
			})
		]
	},
	{
		effectName: "Shutters",
		effectDescription: "Structured sliced wash that should read like light shaping rather than glowing panels.",
		variants: [
			createTestLabVariantDefinition({
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				buildState: buildTestLabShutters
			}),
			createTestLabVariantDefinition({
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				buildState: buildTestLabShutters
			})
		]
	},
	{
		effectName: "Edge Runner",
		effectDescription: "Directed runner beam intended to travel along room structure instead of filling surfaces broadly.",
		variants: [
			createTestLabVariantDefinition({
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				buildState: buildTestLabEdgeRunner
			}),
			createTestLabVariantDefinition({
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				buildState: buildTestLabEdgeRunner
			})
		]
	},
	{
		effectName: "Silhouette Cut",
		effectDescription: "Hard reveal cut that should open the room sharply instead of behaving like a wash.",
		variants: [
			createTestLabVariantDefinition({
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				buildState: buildTestLabSilhouetteCut
			}),
			createTestLabVariantDefinition({
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				buildState: buildTestLabSilhouetteCut
			})
		]
	},
	{
		effectName: "Room Window Beat",
		effectDescription: "Rhythmic window-like reveal keyed to beats rather than continuous motion or fill.",
		variants: [
			createTestLabVariantDefinition({
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				buildState: buildTestLabRoomWindowBeat
			}),
			createTestLabVariantDefinition({
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				buildState: buildTestLabRoomWindowBeat
			})
		]
	},
	{
		effectName: "Aurora Curtain",
		effectDescription: "Ribbon-like drifting bands that should read atmospheric rather than as broad wash blobs.",
		variants: [
			createTestLabVariantDefinition({
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				buildState: buildTestLabAuroraCurtain
			}),
			createTestLabVariantDefinition({
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				buildState: buildTestLabAuroraCurtain
			})
		]
	},
	{
		effectName: "Floor Halo",
		effectDescription: "Localized underglow effect that should read as deliberate floor light rather than diffuse spill.",
		variants: [
			createTestLabVariantDefinition({
				variantKey: "floor",
				variantLabel: "Centered",
				surfaceKey: "floor",
				buildState: buildTestLabFloorHalo
			}),
			createTestLabVariantDefinition({
				variantKey: "directional",
				variantLabel: "Directional",
				surfaceKey: "floor",
				buildState: buildTestLabFloorHalo
			})
		]
	},
	{
		effectName: "Flashlight",
		effectDescription: "Focused cone-like effect for judging isolated reveal-versus-tint behavior under a tight beam.",
		variants: [
			createTestLabVariantDefinition({
				variantKey: "ceiling",
				variantLabel: "Ceiling",
				surfaceKey: "ceiling",
				buildState: buildTestLabFlashlight
			}),
			createTestLabVariantDefinition({
				variantKey: "wall",
				variantLabel: "Wall",
				surfaceKey: "wall",
				buildState: buildTestLabFlashlight
			}),
			createTestLabVariantDefinition({
				variantKey: "floor",
				variantLabel: "Floor",
				surfaceKey: "floor",
				buildState: buildTestLabFlashlight
			})
		]
	}
];

const testLabLightingPresetDefinitions = [];

for (let effectIndex = 0; effectIndex < testLabLightingEffectDefinitions.length; effectIndex += 1) {
	const effectDefinition = testLabLightingEffectDefinitions[effectIndex];
	for (let variantIndex = 0; variantIndex < effectDefinition.variants.length; variantIndex += 1) {
		const variantDefinition = effectDefinition.variants[variantIndex];
		testLabLightingPresetDefinitions.push({
			name: effectDefinition.effectName,
			description: effectDefinition.effectDescription,
			effectName: effectDefinition.effectName,
			effectDescription: effectDefinition.effectDescription,
			effectIndex: effectIndex,
			effectCount: testLabLightingEffectDefinitions.length,
			variantKey: variantDefinition.variantKey,
			variantIndex: variantIndex,
			variantCount: effectDefinition.variants.length,
			variantLabel: variantDefinition.variantLabel,
			surfaceKey: variantDefinition.surfaceKey,
			buildState: (function(currentVariantDefinition) {
				return function(state, timeSeconds, audioMetrics) {
					currentVariantDefinition.buildState(state, timeSeconds, audioMetrics, currentVariantDefinition.variantKey);
				};
			})(variantDefinition)
		});
	}
}
