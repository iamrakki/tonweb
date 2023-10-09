import React, { useEffect, useState } from "react";
import TonWeb from "tonweb";
import axios from "axios";

function FileUpload({ setJsonCID }) {
  const [file, setFile] = useState(null);
  const [imageCID, setImageCID] = useState("");
  const [jsonCID, setJsonCIDLocal] = useState(""); // Local state to manage jsonCID
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const pinataApiKey = "ddaa653a0a2e4905e244";
    const pinataApiSecret =
      "0a118681691f75b732e420652e7497baebc1d1184433ac85eeb7c9af2cbd7d95";

    const headers = {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataApiSecret,
      "Content-Type": "multipart/form-data"
    };

    try {
      // Send the image file to Pinata for IPFS pinning
      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers
        }
      );

      const newImageCID = response.data.IpfsHash;
      setImageCID(newImageCID);

      // Create and upload JSON after successfully uploading the image
      await createAndUploadJSON(newImageCID);
    } catch (error) {
      console.error("Error uploading image file to Pinata:", error);
      setError("Error uploading image file to Pinata.");
    }
  };

  const createAndUploadJSON = async (imageCID) => {
    const ipfsData = {
      image: `ipfs://${imageCID}`
    };

    const jsonBlob = new Blob([JSON.stringify(ipfsData, null, 2)], {
      type: "application/json"
    });

    const jsonFormData = new FormData();
    jsonFormData.append("file", jsonBlob);

    const pinataApiKey = "ddaa653a0a2e4905e244";
    const pinataApiSecret =
      "0a118681691f75b732e420652e7497baebc1d1184433ac85eeb7c9af2cbd7d95";

    const headers = {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataApiSecret,
      "Content-Type": "multipart/form-data"
    };

    try {
      // Upload the JSON file containing the image CID to Pinata
      const response = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        jsonFormData,
        {
          headers
        }
      );

      const newJsonCID = response.data.IpfsHash;
      setJsonCIDLocal(newJsonCID); // Update the local jsonCID state
      setJsonCID(newJsonCID); // Pass jsonCID to the parent component
    } catch (error) {
      console.error("Error uploading JSON to Pinata:", error);
      setError("Error uploading JSON to Pinata.");
    }
  };

  useEffect(() => {
    // When jsonCID changes, update the local jsonCID state
    setJsonCIDLocal(jsonCID);
  }, [jsonCID]);

  return (
    <div>
      <h2>File Upload to IPFS via Pinata</h2>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload Image</button>
      {imageCID && (
        <div>
          <p>Image IPFS CID: {imageCID}</p>
        </div>
      )}
      {jsonCID && (
        <div>
          <p>JSON IPFS CID: {jsonCID}</p>
        </div>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

function TonWebIntegration({ jsonCID }) {
  useEffect(() => {
    const $ = (selector) => document.querySelector(selector);

    // BLOCKCHAIN
    const { NftCollection, NftItem } = TonWeb.token.nft;

    const tonweb = new TonWeb(
      new TonWeb.HttpProvider("https://testnet.toncenter.com/api/v2/jsonRPC", {
        apiKey:
          "840d28de69582aa64848c262cd4633e9736ebc73b7c3cb79c75af1b944368192"
      })
    );

    const init = async () => {
      if (!window.tonProtocolVersion || window.tonProtocolVersion < 1) {
        alert("Please update your TON Wallet Extension");
        return;
      }

      const provider = window.ton;
      const accounts = await provider.send("ton_requestWallets");
      const walletAddress = new TonWeb.utils.Address(accounts[0].address);
      console.log("wallet address=", walletAddress.toString(true, true, true));

      const nftCollection = new NftCollection(tonweb.provider, {
        ownerAddress: walletAddress,
        royalty: 0.05,
        royaltyAddress: walletAddress,
        collectionContentUri:
          "https://gold-exact-termite-826.mypinata.cloud/QmREpWjFfTeQgqoxcrdTS2xsvMy8nyX5wXuXx7NwQhGaLj",
        nftItemContentBaseUri:
          "https://gold-exact-termite-826.mypinata.cloud/ipfs/",
        nftItemCodeHex: NftItem.codeHex
      });
      const nftCollectionAddress = await nftCollection.getAddress();
      console.log(
        "collection address=",
        nftCollectionAddress.toString(true, true, true)
      );

      let itemIndex = 0;

      const deployNftCollection = async () => {
        const stateInit = (await nftCollection.createStateInit()).stateInit;
        const stateInitBoc = await stateInit.toBoc(false);
        const stateInitBase64 = TonWeb.utils.bytesToBase64(stateInitBoc);

        provider.send("ton_sendTransaction", [
          {
            to: nftCollectionAddress.toString(true, true, true),
            value: TonWeb.utils.toNano("0.05").toString(),
            stateInit: stateInitBase64,
            dataType: "boc"
          }
        ]);
      };

      const deployNftItem = async () => {
        const amount = TonWeb.utils.toNano("0.05");

        const body = await nftCollection.createMintBody({
          amount: amount,
          itemIndex: itemIndex,
          itemOwnerAddress: walletAddress,
          itemContentUri: jsonCID
        });
        const bodyBoc = await body.toBoc(false);
        const bodyBase64 = TonWeb.utils.bytesToBase64(bodyBoc);

        provider.send("ton_sendTransaction", [
          {
            to: nftCollectionAddress.toString(true, true, true),
            value: amount.toString(),
            data: bodyBase64,
            dataType: "boc"
          }
        ]);

        itemIndex++;
      };

      const getInfo = async () => {
        const data = await nftCollection.getCollectionData();
        data.ownerAddress = data.ownerAddress.toString(true, true, true);
        console.log(data);
        const nftItemAddress0 = (
          await nftCollection.getNftItemAddressByIndex(0)
        ).toString(true, true, true);
        console.log(nftItemAddress0);

        const nftItem = new NftItem(tonweb.provider, {
          address: nftItemAddress0
        });
        const nftData = await nftCollection.methods.getNftItemContent(nftItem);
        nftData.collectionAddress = nftData.collectionAddress.toString(
          true,
          true,
          true
        );
        nftData.ownerAddress = nftData.ownerAddress?.toString(true, true, true);
        console.log(nftData);
      };

      // BUTTONS
      $("#createCollectionButton").addEventListener("click", async () => {
        await deployNftCollection();
      });

      $("#createNftButton").addEventListener("click", async () => {
        await deployNftItem();
      });

      try {
        getInfo();
      } catch (e) {
        console.error(e);
      }
    };

    if (window.ton) {
      init();
    } else {
      window.addEventListener("tonready", () => init(), false);
    }
  }, [jsonCID]);

  return (
    <div>
      <h1>TON Wallet</h1>
      <button id="createCollectionButton">Create Collection</button>

      {/* No need for an input field for content URI */}
      <button id="createNftButton">Create NFT</button>
    </div>
  );
}

export default function App() {
  const [jsonCID, setJsonCID] = useState(""); // Define jsonCID state here

  return (
    <div>
      <FileUpload setJsonCID={setJsonCID} />
      <TonWebIntegration jsonCID={jsonCID} />
    </div>
  );
}
