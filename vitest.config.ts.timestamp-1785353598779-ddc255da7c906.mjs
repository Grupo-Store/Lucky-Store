import "node:module";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
var vitest_config_default = defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.{test,spec}.{ts,tsx}"]
	},
	resolve: { alias: { "@": path.resolve("/sessions/laughing-happy-shannon/mnt/Lucky-Store", "./src") } }
});
//#endregion
export { vitest_config_default as default };

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidml0ZXN0LmNvbmZpZy5qcyIsIm5hbWVzIjpbXSwic291cmNlcyI6WyIvc2Vzc2lvbnMvbGF1Z2hpbmctaGFwcHktc2hhbm5vbi9tbnQvTHVja3ktU3RvcmUvdml0ZXN0LmNvbmZpZy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZXN0L2NvbmZpZ1wiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgdGVzdDoge1xyXG4gICAgZW52aXJvbm1lbnQ6IFwianNkb21cIixcclxuICAgIGdsb2JhbHM6IHRydWUsXHJcbiAgICBzZXR1cEZpbGVzOiBbXCIuL3NyYy90ZXN0L3NldHVwLnRzXCJdLFxyXG4gICAgaW5jbHVkZTogW1wic3JjLyoqLyoue3Rlc3Qsc3BlY30ue3RzLHRzeH1cIl0sXHJcbiAgfSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczogeyBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSB9LFxyXG4gIH0sXHJcbn0pO1xyXG4iXSwibWFwcGluZ3MiOiI7Ozs7QUFJQSxJQUFBLHdCQUFlLGFBQWE7Q0FDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztDQUNqQixNQUFNO0VBQ0osYUFBYTtFQUNiLFNBQVM7RUFDVCxZQUFZLENBQUMscUJBQXFCO0VBQ2xDLFNBQVMsQ0FBQywrQkFBK0I7Q0FDM0M7Q0FDQSxTQUFTLEVBQ1AsT0FBTyxFQUFFLEtBQUssS0FBSyxRQUFBLG9EQUFtQixPQUFPLEVBQUUsRUFDakQ7QUFDRixDQUFDIn0=