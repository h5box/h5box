import { ref } from 'vue';

export const startupError = ref<string | null>(null);

export const setStartupError = (msg: string) => {
    startupError.value = msg;
};
