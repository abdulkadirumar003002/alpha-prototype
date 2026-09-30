import { AutoTokenizer, AutoModelForCausalLM, TextStreamer }
  from "https://cdn.jsdelivr.net/npm/@huggingface/transformers";

// Check the exact repo ID on Hugging Face (LiquidAI or onnx-community) and edit here.
const MODEL_ID = "LiquidAI/LFM2.5-350M-ONNX";

let tok, model;
const files = {};

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      const progress_callback = (p) => {
        if (p.status === "progress" && p.total) {
          files[p.file] = { l: p.loaded, t: p.total };
          const all = Object.values(files);
          const l = all.reduce((s, x) => s + x.l, 0);
          const t = all.reduce((s, x) => s + x.t, 0);
          postMessage({ type: "progress", pct: (100 * l) / t });
        }
      };
      tok = await AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback });
      model = await AutoModelForCausalLM.from_pretrained(MODEL_ID, {
        device: "webgpu", dtype: "q4", progress_callback,
      });
      // Warm-up: a tiny generation compiles the GPU shaders now, so the first real reply is fast.
      postMessage({ type: "warming" });
      try {
        const wu = tok.apply_chat_template([{ role: "user", content: "hi" }], { add_generation_prompt: true, return_dict: true });
        await model.generate({ ...wu, max_new_tokens: 2, do_sample: false });
      } catch (_) {}
      postMessage({ type: "ready" });
    }
    if (data.type === "chat") {
      const inputs = tok.apply_chat_template(data.messages, {
        add_generation_prompt: true, return_dict: true,
      });
      const streamer = new TextStreamer(tok, {
        skip_prompt: true, skip_special_tokens: true,
        callback_function: (t) => postMessage({ type: "token", t }),
      });
      await model.generate({ ...inputs, max_new_tokens: 256, do_sample: false, streamer });
      postMessage({ type: "done" });
    }
  } catch (e) {
    postMessage({ type: "error", msg: String(e.message || e) });
    if (data.type === "chat") postMessage({ type: "done" });
  }
};
