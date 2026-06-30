import { llm } from "./client";

const response = await llm.chat([
    {
        role: "user",
        content: "Explain recursion in simple words."
    }
]);

console.log(response.content);