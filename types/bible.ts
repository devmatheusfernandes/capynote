export type Bible = {
  [book: string]: {
    [chapter: string]: {
      versos: { [verse: string]: string };
      notas?: string;
    };
  };
};

/*

{
  "Gênesis": {
    "1": {
      "versos": {
        "1": "No princípio Deus criou os céus e a terra.",
        "2": "A terra era vazia e deserta, ..."
      },
      "notas": "^ Gên. 1:2 Ou: ..."
    }
  }
}

// Acesso:
// data["Gênesis"]["1"].versos["1"]


*/
