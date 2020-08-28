import selenium from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import dotenv from 'dotenv'
import pg from 'pg'


const args = process.argv.slice(2)
dotenv.config()

const client = new pg.Client()
await client.connect()

const options = new chrome.Options().headless()
const driver = await new selenium.Builder().forBrowser('chrome').setChromeOptions(options).build()


async function preConsultaPrecos(api_url, data, regiao) {
    const d = data.split("/")
    const dia = `${d[2]}-${d[1]}-${d[0]}`
    const client = new pg.Client()
    await client.connect()
    const selectQuery = 'SELECT * FROM pldhorario where dia = $1 and submercado = $2'

    client.query(
        selectQuery,
        [dia, regiao],
        (err, res) => {
            if (err) {
                console.log(err.stack)
                return
            }
            if (res.rowCount > 0) {
                return
            } else {
                consultaPrecos(api_url, data, regiao)
            }
        }
    )
}

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

        client.query(
            updateQuery,
            dados,
            (err, res) => {
                if (err) {
                    console.log(err.stack)
                    return
                }
                if (res.rowCount > 0) {
                    return
                }
                client.query(
                    insertQuery,
                    dados,
                    (err, _) => {
                        if (err) {
                            console.log(err.stack)
                        }
                    }
                )
            }
        )
    }
}

async function consultaPrecos(api_url, data, regiao) {
    const url = `${api_url}?periodo=${data}&aba=${regiao}`
    let precos = []
    try {
        await driver.get(url);
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
    } catch (e) {
        console.error(e);
    } finally {
        //await driver.close()
    }
    await processaPrecos(precos, data, regiao)
}

(async () => {
    const api_url = "https://www.ccee.org.br/portal/faces/oracle/webcenter/portalapp/pages/publico/oquefazemos/produtos/precos/preco_horario_sombra_grafico.jspx"

    let data = [args[0]]
    let regiao = [args[1]]

    if (!args[0]) {
        data = []
        let now = new Date()
        let donte = new Date()
        for (let i = 0; i < 31; i++) {
            donte.setDate(now.getDate() - i);
            data.push(`${donte.getDate()}/${donte.getMonth()+1}/${donte.getFullYear()}`)
        }
    }

    if (!args[1]) {
        regiao = ["sudeste", "sul", "nordeste", "norte"]
    }

    for (let i=0; i<data.length; i++) {
        for (let k=0; k<regiao.length; k++) {
            await preConsultaPrecos(api_url, data[i], regiao[k])
        }
    }

    client.close()
    driver.close()
    driver.quit()

})();