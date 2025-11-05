type Bible = {
  [book: string]: {
    [chapter: string]: {
      [verse: string]: string;
    };
  };
};

/*

{
    "Nome do Livro": {
      "Número do Capítulo": {
        "Número do Versículo": "Texto do Versículo"
      }
    }
  }

  data["Gênesis"]["1"]["1"]


*/
