import { app } from "./app.js";
import { config } from "./config/env.js";

app.listen(config.PORT, () => {
  console.log(`Backend listening on http://localhost:${config.PORT}`);
});
