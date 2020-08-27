import selenium from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import dotenv from 'dotenv'
import pg from 'pg'


const args = process.argv.slice(2)
dotenv.config()

async function processaPrecos(precos, data, regiao) {
    const insertQuery = 'INSERT INTO pldhorario (dia, hora, submercado, preco) VALUES($1, $2, $3, $4) RETURNING *'
    const updateQuery = 'UPDATE pldhorario SET dia = $1, hora = $2, submercado = $3, preco = $4 where dia = $1 and hora = $2 and submercado = $3 and preco = $4'
    
    for (let i=0; i<precos.length; i++) {
        const p = precos[i]
        const d = data.split("/")
        const dia = `${d[2]}-${d[1]}-${d[0]}`
        const hora = parseInt(p[0].split(":")[0])
        const valor = parseFloat(p[p.length-1].replace(",", ".")).toFixed(2)
        const dados = [dia, hora, regiao, valor]
        
        const client = new pg.Client()
        await client.connect()

        client.query(
            updateQuery,
            dados,
            (err, res) => {
                if (err) {
                    console.log(err.stack)
                    client.end()
                    return
                }
                if (res.rowCount > 0) {
                    client.end()
                    return
                }
                client.query(
                    insertQuery,
                    dados,
                    (err, _) => {
                        if (err) {
                            console.log(err.stack)
                            client.end()
                        }
                        else {
                            client.end()
                        }
                    }
                )
            }
        )
    }
}

(async () => {
    const options = new chrome.Options().headless()
    const driver = await new selenium.Builder().forBrowser('chrome').setChromeOptions(options).build()

    const url = "https://www.ccee.org.br/portal/faces/oracle/webcenter/portalapp/pages/publico/oquefazemos/produtos/precos/preco_horario_sombra_grafico.jspx"

    const data = args[0]
    const regiao = args[1]

    let precos = []
    try {
        await driver.get(`${url}?periodo=${data}&aba=${regiao}`);
        const tds = await driver.findElements(selenium.By.tagName('tr'));

        for (let i=1; i<tds.length; i++) {
            await tds[i].getText().then(s => {
                let linha = s.split(" ")
                precos[i-1] = []
                linha.forEach(l => {
                    if (l !== '') precos[i-1].push(l)
                })
            });
        }
    } finally {
        await driver.quit()
    }
    await processaPrecos(precos, data, regiao)
})();