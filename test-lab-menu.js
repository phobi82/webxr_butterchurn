// TestLab uses a reduced menu so effect review stays focused.

const getTestLabAudioModeLabel = function(args) {
	args = args || {};
	if (args.audioSourceKind === "debug") {
		return "Debug";
	}
	if (args.audioSourceKind === "stream") {
		return args.audioSourceName ? "Live: " + args.audioSourceName : "Live";
	}
	return "None";
};

const createTestLabAudioBarItems = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return [
		{label: "Level", value: clampNumber(audioMetrics.level || 0, 0, 1)},
		{label: "Bass", value: clampNumber(audioMetrics.bass || 0, 0, 1)},
		{label: "Transient", value: clampNumber(audioMetrics.transient || 0, 0, 1)},
		{label: "Beat Pulse", value: clampNumber(audioMetrics.beatPulse || 0, 0, 1)},
		{label: "Strobe", value: clampNumber(audioMetrics.strobeGate || 0, 0, 1)},
		{label: "Left Hit", value: clampNumber(audioMetrics.leftImpact || 0, 0, 1)},
		{label: "Right Hit", value: clampNumber(audioMetrics.rightImpact || 0, 0, 1)}
	];
};

const createTestLabMenuSections = function(args) {
	args = args || {};
	const controls = [
		createCyclerMenuControlState({
			key: "sceneLightPreset",
			label: "Active Effect",
			valueText: args.currentLightPresetEffectName || args.currentLightPresetName || "Soft Wash",
			metaText: args.currentLightPresetEffectDescription || args.currentLightPresetDescription || "",
			hoveredAction: getHoveredCyclerAction(args, "sceneLightPreset:prev", "sceneLightPreset:next"),
			prevAction: {type: "sceneLightPreset.cycle", direction: -1},
			nextAction: {type: "sceneLightPreset.cycle", direction: 1},
			prevHoverKey: "sceneLightPreset:prev",
			nextHoverKey: "sceneLightPreset:next"
		}),
		createCyclerMenuControlState({
			key: "sceneLightingAnchorMode",
			label: "World Anchor",
			valueText: getMenuModeLabelByKey(args.lightingAnchorModes, args.selectedLightingAnchorModeKey, "Auto"),
			metaText: getLightingAnchorModeMetaText(args.selectedLightingAnchorModeKey),
			hoveredAction: getHoveredCyclerAction(args, "sceneLightingAnchorMode:prev", "sceneLightingAnchorMode:next"),
			prevAction: {type: "sceneLightingAnchorMode.cycle", direction: -1},
			nextAction: {type: "sceneLightingAnchorMode.cycle", direction: 1},
			prevHoverKey: "sceneLightingAnchorMode:prev",
			nextHoverKey: "sceneLightingAnchorMode:next"
		})
	];
	if (args.passthroughUiState && args.passthroughUiState.usableDepthAvailableBool) {
		controls.push(createCheckboxMenuControlState({
			key: "passthroughDepthToggle",
			label: "use Depth",
			valueText: args.passthroughUiState.depthActiveBool ? "using Depth" : "using fallback",
			checkedBool: !!args.passthroughUiState.depthActiveBool,
			hoveredBool: hasHoveredActionKey(args, "passthroughDepthToggle:toggle"),
			action: {type: "passthroughDepth.toggle"},
			hoverKey: "passthroughDepthToggle:toggle"
		}));
	}
	appendSliderMenuControls(controls, (args.sceneLightingControls || []).concat(args.effectSemanticControls || []));
	return [
		createMenuSectionState({
			key: "testLabEffect",
			title: "Effect Review",
			badgeText: ((args.currentLightPresetEffectIndex || 0) + 1) + " / " + (args.currentLightPresetEffectCount || 1),
			statusText: args.passthroughUiState && args.passthroughUiState.usableDepthAvailableBool ? (args.passthroughUiState.depthActiveBool ? "using Depth" : "using fallback") : "using fallback",
			controls: controls
		}),
		createMenuSectionState({
			key: "testLabIsolation",
			title: "Isolation",
			statusText: "Audio: " + getTestLabAudioModeLabel(args) + " | Baseline: Uniform / Manual / Mix 100%",
			controls: []
		}),
		createSessionMenuSectionState({
			xrSessionActiveBool: !!args.xrSessionActiveBool,
			hoveredActionKeys: args.hoveredActionKeys
		})
	].filter(Boolean);
};
